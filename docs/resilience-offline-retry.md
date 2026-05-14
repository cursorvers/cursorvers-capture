# Resilience: Offline Recovery + Network Retry Architecture (BS-1 + BS-2 + BS-5)

**Date**: 2026-05-14 (FUGUE 3-agent vote、Wave 1 並列 sprint で W1-1 採択)
**Status**: design doc only — 実装は 次 session / 検証フィードバック取得後
**Scope**: PWA の offline / poor-network 上のアップロード回復、Vercel serverless 10s timeout 制約、API retry の責務分離

---

## 1. 問題の構造

現実の臨床 / 顧問利用環境では、以下 3 つの failure mode が同時発生し得る:

| Failure Mode | 発生例 | 既存対処 |
|---|---|---|
| **(M1) Offline 完全断線** | 院内地下、エレベータ、屋上、夜間 wifi 切断 | (なし) — Service Worker 未実装 |
| **(M2) Poor-network 過渡** | 院内 wifi が混雑、4G が weak、スループット 100kbps 未満 | resumable upload session (Drive `uploadType=resumable`) は持つが、retry なし |
| **(M3) API rate-limit / 5xx** | 連続撮影 5 枚 / 同時多 user / Drive backend 障害 | `app/lib/fetch-wrapper.ts:withRetryableBackoff` (P0-1 で 2026-05-14 実装、Google 推奨 1/2/4/8/16s ladder) |

**現状の致命点**: M1 と M2 は既存 retry layer ではカバーされない。M3 と同一 backoff で扱うと **M1 で永遠 retry → battery drain + 不快感**。**3 mode の責務を分離する必要がある**。

---

## 2. アーキテクチャ方針

### 2.1 3 層分離

```
┌────────────────────────────────────────────┐
│  Layer 3: API Retry (M3 専用)              │
│  - fetch-wrapper.ts:withRetryableBackoff   │
│  - 5xx / 429 / 403(rate-limit) のみ retry  │
│  - 5 attempts, 1-16s ladder, Retry-After   │
├────────────────────────────────────────────┤
│  Layer 2: Online Detection + Pause (M1)    │
│  - navigator.onLine + Network Information  │
│  - offline 検出時は queue に積み、UI に    │
│    「オフライン待機中」を表示              │
│  - 復帰時に queue を flush                 │
├────────────────────────────────────────────┤
│  Layer 1: Capture Queue + Persistence (M2) │
│  - IndexedDB に capture 一時保存 (現状)    │
│  - resumable session URL も persist (現状) │
│  - poor-network 中の interrupt から復帰    │
└────────────────────────────────────────────┘
```

### 2.2 Service Worker の役割 (Phase 2 or 3)

**Service Worker は本 design では optional**。理由:

- IndexedDB persistence + resumable session URL の組み合わせで、ブラウザ復帰時の resume は **Service Worker なしで実現可能**
- Service Worker を入れる本来の価値: **PWA install 後の background sync** (アプリ未起動でも upload 完遂)
- これは検証フェーズの「招待制 advisor が opt-in でアプリを開く」use case では **過剰**

→ Service Worker は **Phase 3 (公開リリース後)** に検討。検証中は Layer 1+2 だけで十分。

### 2.3 Vercel 10s timeout 制約 (BS-2) との関係

PWA から **Drive API を直接呼ぶ** ため、Vercel 側 serverless function を経由しない (chunk upload も)。
唯一 Vercel 経由するのは:

- `/api/me` (tier 判定 + cookie 検証、軽量 < 500ms)
- `/api/capture-webhook` (S10 で導入、撮影完了通知、Codex stub に転送)
- `/api/chatback` (Tier B chat、stub mode で即 return)
- `/api/ocr` (Tier B OCR、stub mode で即 return)

→ **すべて軽量 endpoint で 10s 制約は問題なし** (Tier B 本実装後でも、gateway 経由なので Vercel 側の処理は数百 ms)。

ただし、**Tier B 本実装で gateway 側が 5-10 秒の inference 処理を行う場合**、PWA → Vercel → Gateway の chained call で合計が 10s を超え得る。

**回避**:
- `runtime: "edge"` を Tier B endpoint に明示 (edge function は timeout 制約緩い、最大 30 秒 hobby / 60 秒 pro)
- または PWA から **gateway 直接** を許可 (CORS + Bearer 認証で gate)、Vercel proxy を bypass

→ Tier B 本実装 (Phase B-2) 着手時に切替判断、本 design では「edge function 化」を default 候補として記録。

---

## 3. 実装計画 (本 session では設計のみ、実装は次 session)

### 3.1 Phase α (次 session、半日)

| Slice | 内容 | 規模 |
|---|---|---|
| α-1 | `app/lib/network.ts` 新規: `useOnlineStatus()` hook + `OnlineStatusBanner` component | 1h |
| α-2 | `app/page.tsx` で offline 中の撮影は IndexedDB queue 積み、復帰時 batch upload | 2h |
| α-3 | `__tests__/network.test.ts` + `__tests__/offline-queue.test.ts` 追加 | 1h |

### 3.2 Phase β (次々 session、1 営業日)

| Slice | 内容 | 規模 |
|---|---|---|
| β-1 | Tier B endpoint を `runtime: "edge"` に変更 (4 endpoint) | 2h |
| β-2 | Vercel KV を online/offline transition log 用に使う (任意) | 2h |
| β-3 | poor-network simulation を Playwright で網羅 (`page.context().setOffline()`、`emulateCPU`) | 2h |

### 3.3 Phase γ (Phase 3 / 公開リリース後)

Service Worker + background sync 検討。検証フィードバックで「画面を閉じた後にも upload 完遂したい」要望が **2 件以上** 出たら着手。

---

## 4. 既存実装からの差分

### 4.1 維持される resilience layer

- ✅ `fetch-wrapper.ts:withRetryableBackoff` (P0-1) — Layer 3 はそのまま
- ✅ resumable upload session URL persistence (`app/lib/drive.ts`, S6 で実装)
- ✅ IndexedDB を介した capture 保存 (`app/lib/idb.ts`)

### 4.2 新規追加されるべきもの (本 design の deliverable)

- ✗ Layer 2: online detection + queue
- ✗ Layer 1 enrichment: capture queue の transactional flush + UI feedback
- ✗ telemetry: offline/online transition 発生率を Sentry に送る (Observability plan と整合)

---

## 5. 計測 / 成功条件 (検証フェーズで観測)

実装着手後の Exit 条件:

- [ ] 香西氏 / 長谷川氏が wifi 切断中に撮影 → upload 復帰 を **少なくとも 1 回** 観測
- [ ] capture queue が 5 件溜まった状態でブラウザ再起動 → 復帰時に **全件 flush 成功**
- [ ] 5 連続撮影 (Drive API rate-limit 系) で **データ消失ゼロ**
- [ ] battery drain が「通常使用 + 5%」を超えない (Phase β 完了後計測)

---

## 6. リスク

| Risk | 影響 | 対策 |
|---|---|---|
| IndexedDB が browser 制限で wipe される | capture loss | Storage Persistence API (`navigator.storage.persist()`) を request、Privacy Mode の検知と warning |
| Service Worker 未実装で background sync 不可 | user が「画面を閉じても upload 続行」を期待 | UI で明示「アプリを開いた状態で upload 完了をお待ちください」、検証フィードバックで要望度を測定 |
| Vercel edge function migration で既存 Node API が壊れる | Tier B 本実装が遅延 | Phase B-2 着手前に Tier B 4 endpoint を Node-compat check、edge ランタイム互換性確認 |
| offline 中の大量撮影で IndexedDB quota 超過 | capture loss | 撮影前に `navigator.storage.estimate()` で残量チェック、80% 超過で warning |

---

## 7. 関連 doc / memory

- [app/lib/fetch-wrapper.ts](../app/lib/fetch-wrapper.ts) (Layer 3、P0-1)
- [app/lib/drive.ts](../app/lib/drive.ts) (resumable session)
- [docs/security-pro-tier-storage.md](security-pro-tier-storage.md) (KV / cookie 設計と整合)
- [docs/gateway-integration.md](gateway-integration.md) (Tier B edge function 化候補)
- [OPERATIONS.md](../OPERATIONS.md) §6 (後回し項目に本 doc を追加予定)

## 8. ステータス

| Phase | Trigger | Content |
|---|---|---|
| Current (2026-05-14) | — | 本 design doc 完納 |
| Phase α | 検証フィードバックで offline event 観測、または香西氏配布後 1 週間以内 | Layer 2 実装、検証フェーズ並走 |
| Phase β | Phase α 完了 + Tier B 本実装着手判断 | Edge function 化 + poor-network e2e |
| Phase γ | Service Worker 要望 2 件超 | Background sync 実装 |
