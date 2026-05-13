# gdrive-uploader — Operations SSOT

**最終更新**: 2026-05-13 (FUGUE multi-agent vote 反映後)
**HEAD**: `6444547` / build 98.5 KB First Load JS / test 46 passing + 8 e2e
**Owner**: 大田原正幸 (Cursorvers Founder)
**Reviewer**: Claude (FUGUE orchestrator)、合議: Codex / GLM / OpenCode

本 doc は **invite-only 配布フェーズ完了までの残工程 single-source-of-truth**。
個別の手順は [DEPLOY.md](DEPLOY.md) / [INVITE_ALLOWLIST_NOTES.md](INVITE_ALLOWLIST_NOTES.md) / [DISTRIBUTION_EMAIL_DRAFT.md](DISTRIBUTION_EMAIL_DRAFT.md) を参照する。

---

## 1. ステータス一覧

| 領域 | 状態 | 次アクション |
|---|---|---|
| spec (S1-S12) | ✅ 完納 | — |
| build / tests | ✅ green (46/46 + 8 e2e) | — |
| `.env.local` 雛形 | ✅ 生成済、secret 3 本 pre-generated | user: `__FILL_ME_IN__` 2 箇所 (GOOGLE_CLIENT_ID / INVITE_ALLOWLIST) を投入 |
| GCP OAuth | ⏳ user 待ち | A1 着手 |
| Vercel deploy | ⏳ user 待ち | A4 着手 |
| 配布メール下書き | ✅ 完納 (3 通)、polish v2 反映済 | A7 / A8 タイミング判断 |
| Phase C Gateway | ✅ scaffold 完納 (別 repo) | 別 FUGUE run で B-2 着手 (任意) |

---

## 2. Critical Path (user 操作 ~25-30 分)

3 agent (Codex / GLM / OpenCode) 合議で確定した最小依存順。**A5 は invite-only 検証フェーズでは skip 可能**。

```
[A1] GCP OAuth Client ID 作成
  └─→ [A2] OAuth Test users 投入 (INVITE_ALLOWLIST と同じ email)
        └─→ [A3] .env.local の NEXT_PUBLIC_GOOGLE_CLIENT_ID + INVITE_ALLOWLIST 投入
              └─→ [A4] vercel link → env 投入 → vercel --prod
                    └─→ [A6] smoke test (自分 email でログイン → 撮影 → upload)
                          └─→ [A7] 香西氏に 配布メール A 送信判断
                                └─→ (5/19 長谷川氏面談 後) [A8] 配布メール B 送信判断
```

### 各 Step の Done condition

| # | Step | Done と判定する基準 | 所要 | 参照 |
|---|---|---|---|---|
| A1 | GCP OAuth Client ID 作成 | Console 上に Client ID が表示され、コピー可能 | 5-8 min | [DEPLOY.md §Step 1](DEPLOY.md) |
| A2 | OAuth Test users 投入 | Testing 状態で必要な email が全て Test users に表示 | 2-3 min | [INVITE_ALLOWLIST_NOTES.md §GCP Test Users との同期](INVITE_ALLOWLIST_NOTES.md) |
| A3 | .env.local 投入 | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` が実値、`INVITE_ALLOWLIST` が CSV 形式で実 email、`__FILL_ME_IN__` が残っていない | 2 min | [DEPLOY.md §Step 2](DEPLOY.md) |
| A4 | Vercel deploy | `vercel --prod` が成功し、Production URL が発行される | 5-8 min | [DEPLOY.md §Step 3](DEPLOY.md) |
| A5 | Vercel KV 有効化 (任意) | Storage → KV connect 完了、KV_REST_API_* 自動注入確認 | 3 min | [DEPLOY.md §Step 4](DEPLOY.md) |
| A6 | Smoke test | (1) 自分 email ログイン成功 (2) 撮影→Drive upload 成功 (3) 別 email で `access_denied` 確認 (4) Tier B stub warning がコンソールに出ることを確認 | 5-7 min | [DEPLOY.md §Step 5](DEPLOY.md) |
| A7 | 配布メール A 送信判断 | smoke 全 pass の場合のみ。URL/folder 埋め → 香西氏宛 send | 3-5 min | [DISTRIBUTION_EMAIL_DRAFT.md §A](DISTRIBUTION_EMAIL_DRAFT.md) |
| A8 | 配布メール B 送信判断 | 5/19 面談**後**、長谷川氏の温度感を見て判断 | 3-5 min | [DISTRIBUTION_EMAIL_DRAFT.md §B](DISTRIBUTION_EMAIL_DRAFT.md) |

---

## 3. Checkpoint / Rollback

| 症状 | 即時対処 | rollback |
|---|---|---|
| `redirect_uri_mismatch` | GCP Console の Authorized JavaScript origins に Vercel URL を追加 | — |
| `access_denied` (自分の email) | OAuth Test users に投入されているか確認 | — |
| `access_denied` (招待した advisor) | INVITE_ALLOWLIST と GCP Test users の **両方**に email があるか確認 | — |
| KV undefined errors | Storage 未 connect なら fallback 動作 (S12 polish)、エラー継続なら KV integration を connect | (KV 必須化していないので rollback 不要) |
| INVITE_ALLOWLIST が効かない | Vercel env が Production scope に投入されているか、`NEXT_PUBLIC_` prefix なしか確認 | `vercel env rm INVITE_ALLOWLIST` → 再投入 |
| Tier B (OCR/audio/advisory) stub warning | 想定動作 (Codex Gateway 未接続)。配布対象者には事前案内に含めてあるため対応不要 | — |
| Prod deploy で OAuth 同意画面が「未確認のアプリ」 | 想定動作 (Testing mode)。配布メール A/B でも事前周知済 | — |
| Vercel build fail | local `pnpm build` が green か確認、commit が pushed か確認、ENV 不足が原因なら Dashboard で確認 | `vercel rollback` で前 deploy へ戻す |

---

## 4. INVITE_ALLOWLIST 投入候補 (2026-05-13 時点)

memory `cursorvers_client_roster.md` / `cursorvers_kozai_first_advisory.md` / `cursorvers_yuinozomi_hasegawa_localllm.md` を反映:

| # | 氏名 | 状態 | 投入判断 | 備考 |
|---|---|---|---|---|
| 1 | flux@cursorvers.com | admin | **必須** | smoke test + 緊急対応用 |
| 2 | 大田原正幸 | Founder | **必須** | dogfood |
| 3 | 香西杏子氏 | Active 顧問 | **必須** | 顧問契約 Active、A7 直配布対象 |
| 4 | 長谷川拓也氏 | Lead | 任意 (5/19 後) | A8 タイミング次第。事前投入しておいて A8 送信時に有効化する手も可 |
| 5 | 大田原絵美氏 | 代取 | 任意 | dogfood、配布判断ではない |
| 6 | 梶田医院千葉 | Pro 契約 | 任意 (別途) | `PRO_USERS` への投入も検討 (memory `project_cursorvers_pro_tier_funnel.md`) |

---

## 5. 後回し / 別 run 案件

合議結果に基づき、本 critical path 外として明示:

- **A5**: Vercel KV 有効化 — fallback で十分動作、後で必要時 enable
- **B4-B6**: Notion 同期 / custom domain / gateway 切替 stub — 検証フェーズ完了後で十分
- **C 全体 (cursorvers-codex-gateway Phase B-2+)**: 別 FUGUE run、実 user フィードバック取得後の方が要件が固まる
- **OAuth verification 申請**: Testing mode 100 user 上限まで余裕、超過時に再評価

---

## 6. 検証フェーズ Exit 条件

以下を全て満たした段階で「invite-only 検証フェーズ完了」とし、次 phase (Phase C 本格化 / 公開リリース判断 / scale-up) へ遷移する:

- [ ] 香西氏が 1 回以上 撮影→upload を完遂
- [ ] 香西氏からフィードバック (定性) を 1 件以上 受領
- [ ] dogfood で 1 週間以上 daily 撮影 (`流入があるか` 確認)
- [ ] OAuth Testing mode 内のエラー率 < 5% (smoke test 含む)
- [ ] 長谷川氏 (5/19 面談後) の判断: 配布 or 非配布、いずれかに確定

---

## 7. 関連 doc / memory

| ファイル | 役割 |
|---|---|
| [README.md](README.md) | repo 概要 |
| [spec.md](spec.md) | spec v4.1 (S1-S12 完納記録) |
| [DEPLOY.md](DEPLOY.md) | A1-A6 の手順詳細 (cmd / screenshot 含む) |
| [INVITE_ALLOWLIST_NOTES.md](INVITE_ALLOWLIST_NOTES.md) | A3 の投入候補と GCP Test users 同期手順 |
| [DISTRIBUTION_EMAIL_DRAFT.md](DISTRIBUTION_EMAIL_DRAFT.md) | A7 / A8 の文面 (polish v2) |
| [docs/codex-gateway-spec.md](docs/codex-gateway-spec.md) | Phase C 仕様 (本 SSOT scope 外、別 repo `~/Dev/cursorvers-codex-gateway/`) |
| [HANDOVER.md](HANDOVER.md) | 旧 handover (history、現状は本 doc が active) |
| `~/.claude/state/runs/fugue-gdrive-uploader-2026-05-13/` | 前 FUGUE run state |
| `~/.claude/state/runs/fugue-codex-gateway-2026-05-13/` | Gateway scaffold run state |
| memory `cursorvers_client_roster.md` | ROSTER pointer |
| memory `cursorvers_kozai_first_advisory.md` | 香西氏案件詳細 |
| memory `cursorvers_yuinozomi_hasegawa_localllm.md` | 長谷川氏案件詳細 |

---

## 8. 更新ログ

| Date | 変更 | Source |
|---|---|---|
| 2026-05-13 | 新規作成。Critical Path / Checkpoint / Exit 条件を SSOT 化 | FUGUE multi-agent vote (B3 推奨、2/3 票) |
| 2026-05-13 | 配布メール A/B/C を polish v2 化 (Codex App Server → 「別サーバー」、stub mode → 「現時点では未稼働」、allowlist → 「限定 URL」表記等) | FUGUE multi-agent vote (B2、続編) |
