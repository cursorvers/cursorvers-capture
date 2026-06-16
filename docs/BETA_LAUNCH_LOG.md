# Cursorvers Capture — ベータ launch ログ

ベータ期間中の招待発行・テスター送付・主要マイルストーンの記録。

---

## 🚀 2026-05-21 — 外部初送信 (顧問税理士法人)

### Milestone

**初の外部ユーザー向け招待 URL 送付。**ベータ正式開始。

### 配布内容

| 項目 | 値 |
|---|---|
| 配布先 | 顧問税理士法人 (内部複数名想定) |
| 配布チャネル | Slack |
| Token (note: `顧問税理士法人 内部テスト (拡張)`) | `ef9bd3b3ad4728b1775696cbc5c7bffd` |
| URL | <https://capture.cursorvers.jp/?invite=ef9bd3b3ad4728b1775696cbc5c7bffd> |
| max_uses | 10 |
| expires | 2026-08-31 (約 100 日) |
| 発行者 (issued_by) | flux@cursorvers.com |

### 送付前の準備で完了したこと

- ✅ Phase 18: 利用規約 §1「電子帳簿保存法非対応」明記
- ✅ Phase 18: Privacy Policy §2-A「Gemini API 送信」開示
- ✅ Phase 18b: LP 注記を refined ink palette UI に
- ✅ Phase 19A: cookie fail-closed / lowercase normalize / claim race 緩和
- ✅ Phase 19A2: redirect loop hotfix (isPublicPath に `/` 追加)
- ✅ Phase 19B: DriveUploadError 構造化 + granted_scopes tracking
- ✅ Phase 19C: BETA_DISTRIBUTION_KIT.md 作成 + iOS Safari hint
- ✅ Phase 19D: 設定ページに iOS/Android タブ切替インストールガイド
- ✅ Phase 20: drive.metadata.readonly 削除 → Production 公開 (verification 不要)
- ✅ GCP Console: 公開ステータス「本番環境」へ切替済

### 期待される顧客体験 (Phase 20 後)

| Step | 動作 |
|---|---|
| 招待 URL クリック → ホーム表示 | OK |
| Google サインイン | 403 出ない、未確認警告も出ない |
| 招待 claim → Trial 60 日 開始 | OK |
| Picker でフォルダ選択 → 名前表示 | OK (picker callback 経由) |
| 撮影 → AI 解析 → Drive 保存 | OK |
| /history 一覧 + 詳細シート + コメント + 題名編集 | OK |

### 未対応 (許容範囲)

| 項目 | 補足 |
|---|---|
| Drive web から直接 upload したファイルが /history で見えない | drive.file scope の仕様、整理ツール用途では許容 |
| 7 日 refresh token 失効 | non-sensitive scope のみなので適用されず |
| 100 名上限 | 同上、適用されず |

### 想定される問い合わせ + 回答 (FAQ)

| Q | A |
|---|---|
| 電帳法対応してる? | 対応していません。整理用です。紙原本は別途保管前提。 |
| Drive のサーバに残らない? | 画像本体は残らない。AI 解析時のみ Gemini API に一時送信、弊社では保存しない。 |
| 月額? | ベータ無料・60 日。商用ローンチ時の価格は未定。 |
| クライアント展開可能? | 内部テスト後、ご判断いただければ追加 URL 発行可能。 |

---

## 🗂 招待発行履歴 (cumulative)

| 日付 | Token | note | max_uses | expires | 状態 |
|---|---|---|---|---|---|
| 2026-05-20 | `e9dc6cb554cb82a74c186d147f9dc373` | Phase 12 test invite | 1 | 2026-06-20 | 内部テスト用 |
| 2026-05-20 | `471454ae1e284f277399c2a1d3457986` | 3mo test invite | 1 | 2026-08-20 | 内部テスト用 |
| 2026-05-20 | `175dca603f0ee5f8a34fad523b58ae52` | beta tester 1 | 1 | 2026-07-21 | 検証用 |
| 2026-05-20 | `8dcf603dbf967172bbb269fe96bc34af` | beta tester 2 (re-issue) | 1 | 2026-07-21 | 検証用 |
| 2026-05-20 | `8f0eadf3ed14803bcc46bb6ec1d5a0f6` | beta tester 3 (re-issue) | 1 | 2026-07-21 | 検証用 |
| 2026-05-20 | `6596007915071804c4bb72a38684af54` | 税理士法人デモ | 3 | 2026-08-31 | 予備 |
| 2026-05-20 | `91d4cd9e6158c4779a4d9c28a0338fc5` | 顧問税理士 ベータ専用 | 2 | 2026-08-20 | (初版、再発行で superseded) |
| **2026-05-21** | **`ef9bd3b3ad4728b1775696cbc5c7bffd`** | **顧問税理士法人 内部テスト (拡張)** | **10** | **2026-08-31** | **🚀 配布中** |

---

## 📊 次のマイルストーン (予定)

| 想定タイミング | イベント |
|---|---|
| 1-3 日以内 | 顧問税理士法人 初動フィードバック (動作 / 体験) |
| 1 週間以内 | 不具合・改善要望対応 |
| 2-4 週間以内 | クライアント展開可否判断 → 追加 URL 発行 |
| 2-3 ヶ月以内 | 価格決定 + Phase 13b (Stripe Checkout) 着手 |
| 商用ローンチ前 | Phase 16 残セキュリティ強化、特商法表記、弁護士レビュー |

---

## 🚨 2026-05-26 — Codex Gateway 502 incident & fix (Phase 22)

### What happened

顧問税理士法人テスター (`ikegami.hiroki@sirius-ta.com`) が iPhone から撮影:
- Drive 保存 ✅ 成功
- AI 振り分け ❌ 「Codex unreachable (502)」+ 生 HTML エラーで失敗

### Root cause (3-critic verification 一致)

5-12MB 画像の base64 を CF Worker 経由で Gemini に渡す際、Worker platform layer
(CPU / memory / wall time) が exhaustion → CF が default 502 HTML を返す。
Worker code 内の middleware timeout は走らない (より下層で abort)。

### Fix (Phase 22, deployed 2026-05-26)

**22a. UI 改善 (`app/components/CaptureAnalysisPanel.tsx`)**
- 生 HTML 露出を撤廃 (code 別 friendly message)
- 「✅ Drive 保存完了 / ⚠️ AI 整理は未完了」分離表示
- 「🔁 もう一度 AI で整理する」retry button
- 「Drive で開く ↗」link で部分成功への安心感
- `app/lib/capture-analysis.ts`: `CodexAnalysisError` (gateway_unavailable / gateway_timeout / rate_limited / payload_too_large / unauthorized / unknown) + 429/5xx 1 回 retry (1.5s backoff)
- `app/page.tsx`: `handleRetryAnalysis` + image blob 保持

**22b. Proxy 改善 (`functions/api/codex/analyze.ts`)**
- upstream HTML → structured JSON error 正規化
- network 失敗時も JSON 502 で返す
- console.error 構造化ログ (status / contentType / bodyPreview)

**22c. Root cause 緩和 (`app/lib/image-resize.ts` 新規)**
- Client-side resize: 長辺 2400px / JPEG quality 0.82 (→ 0.7 → 0.55 段階)
- Hard cap 4MB
- **Drive にはオリジナル**を上げ、**AI 解析にのみ resize 版**

### Deferred (next phase)

- Phase 22d: Worker 側 structured error class (Gemini timeout / rate / key / model 別)
- Phase 22e: Health canary worker (Cron, 5-15min, 合成画像で /v1/analyze 叩く)
- Phase 22f: Discord webhook 通知 (失敗 spike 検知)
- Phase 22g: KPI 集計 (HMAC user hash + size bucket、privacy-preserving)

### Lessons (prevention)

1. **未圧縮の生画像を CF Worker に渡してはいけない** — 必ず client-side resize
2. **Proxy 層で必ず JSON 正規化** — upstream の HTML/Empty を client に出さない
3. **失敗時の UX で部分成功を明示** — テスターは「全部壊れた」と誤解しやすい
4. **テスター送付前に大きな実画像で end-to-end 検証** — Pixel テストが浅かった

---

## 🛡 2026-05-26 — Phase 22.1 + 22.2 ハードニング (multi-agent verification)

### Phase 22.1 — 3-critic simulation で発覚した HIGH issues hotfix

3-critic 並列 verification (Codex code-reviewer / GLM general-reviewer / Codex security-analyst) で Phase 22 デプロイ後の本番動作をシミュレートし、6 件の HIGH/MED issue を発見・即修正。

| P# | Issue | Fix |
|---|---|---|
| P1 | `/api/codex/*` middleware 302 → fetch follows → HTML → JSON parse fail | isPublicPath に追加 (proxy 自身で cookie 検証) |
| P2 | `resizeImageForAI` fallback で 4MB 超画像が AI 送信される | `ImageResizeError` throw 化、段階的 quality (0.82→0.7→0.55→0.4) |
| P3 | fetch network error が retry されない (status=0) | `network_error` code 新設 → retryable: true |
| P4 | retry cap なし → 連投リスク | 最大 3 attempts、exponential backoff (1.5s, 3s) |
| P5 | EXIF GPS 漏洩 (fallback path) | canvas re-encode 強制 |
| P6 | Cookie 切れ時の「再認可」誘導なし | unauthorized error → 「🔐 設定 → 再認可」link |

verify: `curl POST /api/codex/analyze` (no cookie) → **HTTP 401 JSON** 確認済 (was 302 redirect)

### Phase 22.2 — 残課題 A-G を並列で全完遂

| # | Item | スコープ | 検証 |
|---|---|---|---|
| **A** | `navigator.onLine` 検出 | capture-analysis.ts | offline 時に gateway を叩かない |
| **B** | SW v1→v2 update banner | SWRegistry.tsx | 強制 reload 撤廃、ユーザー操作型 |
| **C** | CSRF Origin/Referer check | functions/api/codex/analyze.ts | curl cross-site → **403 JSON** ✓ |
| **D** | Gateway Gemini structured errors | gateway src/providers/gemini.ts | 9 種類分類 (invalid_key/rate_limited/safety_block/...) |
| **E** | Health canary cron | gateway worker.ts | `schedule: */15 * * * *` 適用 ✓ |
| **F** | Discord webhook helper | gateway src/lib/notify.ts | env optional、未設定なら no-op |
| **G** | KPI structured logging | gateway src/lib/notify.ts | privacy-preserving (画像/email 不含) |

### 顧問税理士へのフォロー

- Slack に修正完了報告を送付済 (2026-05-26)
- 再試行のため PWA 完全再起動を依頼

### 手動 setup 残 (任意)

- Discord 通知 ON: `cd cursorvers-codex-gateway && npx wrangler secret put DISCORD_WEBHOOK_URL`
- Canary auth: GATEWAY_AUTH_KEYS 自動流用、特別指定する場合のみ `CANARY_AUTH_TOKEN` set

### Lessons (Phase 22 全体)

1. **未圧縮画像を Worker に渡さない** — client-side resize 必須
2. **proxy 層は HTML/Empty を絶対透過しない** — JSON 正規化を契約
3. **失敗時 UX で部分成功 (Drive ✓ / AI ✗) を明示** — テスター誤解防止
4. **送付前に大画像で end-to-end 検証** — Pixel 上で実画像確認
5. **3-critic simulation を Phase 22 のような fix にも適用** — 単独 deploy 後の盲点を補完
6. **gateway 側でも structured error + canary + KPI** — proactive 監視がベータ品質を担保

---

## 📨 2026-05-26 — Phase 22.1+22.2 follow-up Slack 送付

- 配信先: 顧問税理士法人 (ikegami.hiroki@sirius-ta.com)
- 配信チャネル: Slack
- 内容: 6 件改善点 + PWA 再起動依頼 + キャッシュ刷新方法 (iOS/Android)
- 次の判定タイミング: 1-3 日以内の動作報告

---

## 🚨 2026-06-15 — Phase 22.3: White-out 緊急修復 (3-critic ErrorBoundary 主因確定)

### What happened

founder が Pixel + iPhone で `https://capture.cursorvers.jp/` にアクセス → **完全白画面**。
シークレットウィンドウでも再現、SW v2 → v3 強制刷新後も再現。

### Server probe は全 green

- HTML 11KB 配信 OK
- 全 JS chunk 200 OK
- CSP 正常
- Gateway /health 200 OK

→ Server 側は問題なし、client crash で skeleton ごと unmount している仮説。

### Root cause (3-critic 一致)

| 階層 | 内容 |
|---|---|
| 1 (主因) | **layout に ErrorBoundary が無く、client crash で skeleton も巻き込まれて完全白画面** |
| 2 | Phase 22.1/22.2 で導入した `createImageBitmap` / `SWRegistry` / `useSearchParams + Suspense` が iOS WebKit で例外を投げる可能性 |
| 3 | PWA キャッシュが固定化、SW controller が古い版を握ったまま |

### Fix (Phase 22.3, deployed 2026-06-15)

**A. `app/components/RootErrorBoundary.tsx` 新規**
- React class ErrorBoundary
- fallback UI: 「画面の表示に失敗しました」+「再読込」+「キャッシュごとリセット」ボタン
- 「キャッシュごとリセット」は SW unregister + caches.delete 全削除 + reload

**B. `app/layout.tsx` を `<RootErrorBoundary>` でラップ**
- どんな client crash でも skeleton 巻き込まれず復旧 UI が出る

**C. `app/lib/image-resize.ts` に typeof feature detection guard**
- iOS 古い WebKit で undefined → ReferenceError を回避
- 未対応環境では HTMLImageElement そのまま使用

**D. SW v3 → v4 bump**
- activate handler で全 cache 強制 evict

### Verify

- production /sw.js → `app-shell-v4` ✓
- layout chunk hash 変更: `layout-f00ce8b71219612b.js` (新 deploy 反映)
- layout chunk 内に `RootErrorBoundary`, `componentDidCatch`, `getDerivedStateFromError` 確認済 ✓

### Founder 報告

「動き出した」確認 — Phase 22.3 デプロイ後の動作復旧。

### Lessons (Phase 22 family 通算)

1. layout 直下に ErrorBoundary を最初から入れる
2. Web API は `typeof globalThis.X === "function"` で feature detect (`"X" in window` は誤判定)
3. PWA cache eviction は SW SHELL 名 bump が最確実
4. build artifact (`out/`) は source 変更後に削除して再 build
5. proxy 層は HTML/Empty を絶対透過しない (JSON 正規化を契約)
6. 未圧縮の生画像を CF Worker に渡さない
7. 失敗時 UX で部分成功を明示
8. 3-critic simulation を本番 fix にも適用 (盲点が頻繁に発覚)
9. gateway 側でも structured error + canary + KPI
10. Next.js static export の BAILOUT_TO_CLIENT_SIDE_RENDERING marker は仕様だが、ErrorBoundary 無いと crash 時に skeleton も消える
11. 顧問テスター送付前に大画像 (5-12MB) で end-to-end 検証
