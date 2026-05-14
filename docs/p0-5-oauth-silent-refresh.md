# P0-5: OAuth Token Silent Refresh Edge Case Design

**Date**: 2026-05-14 (FUGUE 3-agent vote、Wave 1 W1-3 採択、前回 P0 で deferred)
**Status**: design + audit doc。実装の確認 / 補修は次 session
**Scope**: Google Identity Services (GIS) の token refresh 戦略、長時間利用 session の認証維持

---

## 1. なぜ P0 か

配布対象の **臨床 / 顧問利用 pattern**:

- 外来診療 1 セッション = 2-3 時間連続使用想定
- 1 日に複数回 (午前外来 / 午後外来 / 病棟回診)
- スマホをポケットに入れたまま **背景動作** 期間あり

→ Google access_token は **デフォルト 1 時間で expire**。silent refresh が機能しないと:

1. 撮影完了直後の upload が 401 になる
2. user は「アプリの調子が悪い」と感じる
3. 再 sign in が必要、 friction 大

---

## 2. 既存実装 audit

### 2.1 `app/lib/gis.ts` の現状 (grep 結果から)

```ts
// const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
// scope = "https://www.googleapis.com/auth/drive.file"
// fetch /userinfo で email 取得
// fetch /sign-in API で gdrive_email cookie 設定
```

確認すべき関数:

- `getCurrentToken()` — token 存在チェック、expire 判定
- `silentRefresh()` — token 再取得 (本 doc の焦点)
- `signOut()` — token revoke + cookie clear

**次 session で実コード grep + 設計適合性確認** が必要 (本 doc は spec のみ起草):

```bash
grep -n "expires_in\|expires_at\|refresh\|setTimeout\|silentRefresh" app/lib/gis.ts
```

### 2.2 既存 fetch-wrapper の関係

`app/lib/fetch-wrapper.ts` で 401 response を検出した場合:

```ts
// 既存設計 (P0-1 で確認)
if (response.status === 401 && !didRefresh401) {
  await silentRefresh();
  didRefresh401 = true;  // 1 度のみ
  continue;
}
throw new TokenExpiredError();
```

これは **reactive refresh** (401 を見てから refresh)。問題:

- (P1) 401 が発生する瞬間に user の体感 latency が発生
- (P2) chunk upload 中に 401 が出ると、resumable session の URL は維持されるが progress が止まる
- (P3) refresh 失敗 (refresh_token revoked, ネットワーク断) の handling 不明

→ **proactive refresh** (expire 直前に先回り refresh) を併用するのが best practice。

---

## 3. 推奨設計

### 3.1 Hybrid: Proactive + Reactive Refresh

```
┌─────────────────────────────────────────────┐
│  Proactive: expiry の 5 分前に silent refresh │
│  - setTimeout で expires_at - 300_000 にタ   │
│    イマー設定                                │
│  - tab visible 中のみ実行 (battery 配慮)     │
│  - 失敗時は次の reactive refresh に委ねる    │
├─────────────────────────────────────────────┤
│  Reactive: 401 検出時 (既存) で fallback     │
│  - fetch-wrapper.ts:driveFetch の現実装維持  │
│  - 1 度の再試行、失敗で TokenExpiredError    │
├─────────────────────────────────────────────┤
│  User Re-Auth Trigger:                       │
│  - TokenExpiredError → UI banner            │
│  - 「セッションが切れました、再ログインし    │
│    てください」+ sign-in button             │
│  - 直前 capture は queue に保存 (Layer 1 と  │
│    整合、Resilience doc 参照)                │
└─────────────────────────────────────────────┘
```

### 3.2 expires_at の persistence

現状 `getCurrentToken()` が `expires_in: 3600` を どう保持しているか未確認。次 session で確認すべき:

- `localStorage` か `IndexedDB` か `memory only`
- tab 跨ぎで shared か isolated か
- page reload で復元可能か

**推奨**: `localStorage` に `expires_at` (epoch ms) を保存。memory only だと tab reload で消失 → 即 reactive refresh が走り user 体感不快。

### 3.3 refresh_token の扱い

Google Identity Services の `prompt=none` mode は **refresh_token なしで silent refresh** を実現 (GIS auth flow 内部で hidden iframe を使う)。

利点:
- refresh_token を client 側に持たなくてよい (security 利点)
- Google 側で session 維持

注意点:
- user が **別の Google アカウントに切り替え** た場合に silent refresh が prompt 表示なしで別 user の token を返す → 攻撃ベクトル
- → silent refresh 後の token で `/userinfo` を呼んで email 一致を確認 (既存実装で実施されているか要確認)

### 3.4 edge case 対応

| Edge Case | 対応 |
|---|---|
| **長時間 idle** (e.g. 3 時間操作なし) | proactive refresh は visible 中のみ → focus 復帰時に expires_at をチェック、過去なら即 silent refresh |
| **OAuth scope 変更** | (本 PWA は変更不要、Phase B-2 で Tier B endpoint を `drive` scope ではなく `drive.file` のままで維持する原則) |
| **user が他端末から sign out** | silent refresh が `interaction_required` を返す → reactive flow へ降格 |
| **refresh_token revocation** | user に「セキュリティ上の理由で再ログインが必要」message + sign-in button |
| **複数 tab で同時 refresh** | navigator.locks API で mutual exclusion、または refresh in flight を Promise 共有 |

---

## 4. 実装計画 (次 session で着手)

### 4.1 Phase α (半日)

| Slice | 内容 | 規模 |
|---|---|---|
| α-1 | `app/lib/gis.ts` audit: `expires_at` の persistence 経路を grep + 不足あれば修正 | 1h |
| α-2 | `scheduleProactiveRefresh(expiresAt)` 関数を追加。`document.hidden` チェック + cancel ロジック | 1h |
| α-3 | `__tests__/gis-refresh.test.ts` 新規: proactive + reactive の hybrid 動作を vi.useFakeTimers で検証 | 2h |

### 4.2 Phase β (1 営業日)

| Slice | 内容 | 規模 |
|---|---|---|
| β-1 | multi-tab 同時 refresh で navigator.locks (or fallback) を使う mutual exclusion | 2h |
| β-2 | silent refresh 後の `/userinfo` email 一致確認 → mismatch なら sign-out 強制 (account switch 攻撃対策) | 1h |
| β-3 | TokenExpiredError UI banner + capture queue 連携 (Resilience doc Layer 1 と integration) | 2h |

### 4.3 Phase γ (検証後)

- Sentry 等で「proactive refresh 成功率」を測定 (Observability plan と連携)
- 期待値: > 95% (5 分 buffer で大半の case をカバー、reactive で残り)

---

## 5. user 検証手順

deploy 完了後の **検証フェーズ 1-2 週目** に user (大田原氏 / 香西氏) が観察:

- [ ] 1 セッション 2 時間連続使用 → 再ログイン prompt なし
- [ ] 一旦アプリを閉じて 30 分後再開 → 自動 token refresh で immediate にアプリ使用可
- [ ] 別 device で sign out → 元 device に戻る → 「再ログインしてください」message + 撮影 queue は失われない
- [ ] OAuth Testing mode 期間中 (現フェーズ) は **7 日で refresh_token expire** の制約あり、これも検証範囲に含める

---

## 6. リスク

| Risk | 影響 | 対策 |
|---|---|---|
| **Testing mode の 7 日 expire** | Production migration 前に user が毎週再ログイン強制 | OAuth verification 申請 (P2-4) で解消、それまで配布メールで事前周知 |
| proactive refresh タイマーが battery を食う | mobile battery drain | document.hidden チェック + 1h interval (5 分前にだけ refresh) |
| `prompt=none` で別 account の token が返る | session hijack 可能性 | silent refresh 後の email 一致確認 (β-2) |
| multi-tab race | token 重複取得 / state 混乱 | navigator.locks (β-1) |

---

## 7. 関連

- [app/lib/gis.ts](../app/lib/gis.ts) (現実装、grep audit 対象)
- [app/lib/fetch-wrapper.ts](../app/lib/fetch-wrapper.ts) (reactive 401 refresh path)
- [docs/resilience-offline-retry.md](resilience-offline-retry.md) (TokenExpiredError → queue 連携)
- [docs/security-pro-tier-storage.md](security-pro-tier-storage.md) (signed cookie 設計と整合)
- memory `feedback_supabase_no_verify_jwt.md` (webhook signature 必須化)
- Google docs: https://developers.google.com/identity/oauth2/web/guides/use-token-model

## 8. ステータス

| Phase | Trigger | Content |
|---|---|---|
| Current (2026-05-14) | — | design + audit 観点 doc 完納 |
| Phase α | 配布前 or 配布後 1 週間以内に再ログイン頻度高なら | Proactive refresh + audit + test |
| Phase β | Phase α 完了 + multi-tab usage 観測 | Multi-tab lock + account switch 防御 |
| Phase γ | Sentry 導入 (Observability plan 完了後) | refresh 成功率モニター |
