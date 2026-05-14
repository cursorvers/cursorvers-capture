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

## 3. 失敗時の 5 分以内復旧 (緊急 fallback)

| 症状 | 5 分で実行する 1 アクション | 影響 |
|---|---|---|
| 全 user が `access_denied` で入れない | Vercel Dashboard → 環境変数 → `INVITE_ALLOWLIST` 値が空でないか確認、空なら直前 deploy へ rollback | サービス回復 ~2 min |
| 配布対象 advisor 1 名だけ入れない | `INVITE_ALLOWLIST` と GCP OAuth Test users **両方** に email が入っているかチェック (片側だけだと拒否) | 個別解決 ~3 min |
| `redirect_uri_mismatch` | GCP Console → Credentials → OAuth Client → Authorized JavaScript origins に現 Vercel URL (or custom domain) を追加 | 再 deploy 不要、即時反映 |
| Vercel build fail (deploy 直後) | `vercel rollback` で直前 deploy に戻す → fail 原因を local `pnpm build` で再現 | サービス断ゼロ |
| Tier B (OCR/audio/advisory) でエラー | `OPENAI_APPS_SDK_*` env を Vercel から削除 → 自動 stub fallback (memo `docs/gateway-integration.md` §6) | サービス断ゼロ |

緊急時は **これらを最初に試す**。原因究明より先に user を元の動作に戻す。

## 4. Checkpoint / Rollback (詳細表)

§3 で復旧しなかった場合、または事前に把握しておく非緊急の判断材料:

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

## 5. INVITE_ALLOWLIST 投入候補 (2026-05-13 時点)

memory `cursorvers_client_roster.md` / `cursorvers_kozai_first_advisory.md` / `cursorvers_yuinozomi_hasegawa_localllm.md` を反映:

### 投入時のルール

- **case 正規化**: `middleware.ts` 側が server-side で `.toLowerCase()` をかけている前提だが、Vercel env 投入時も全 email を **小文字** で揃える (`info@example.com`、`info@Example.COM` でない)。実装側の normalize に依存しないよう defense-in-depth
- **trim**: 末尾 / 先頭の空白なし。Vercel Dashboard で copy-paste 時に半角スペースが入りやすい
- **重複排除**: 投入前に sort + uniq、目視で重複を取る
- **Gmail dot-insensitive 注意**: `foo.bar@gmail.com` と `foobar@gmail.com` は Gmail 上は同一アカウントだが、INVITE_ALLOWLIST には advisor が**実際にログインに使う表記** をそのまま入れる (両表記を投入してもエラーにはならない)
- **100 user 上限警告**: GCP OAuth Testing mode の Test users は **100 件上限**。50 件を超えた段階で next-action として「Production 申請 (OAuth verification) or 50 件以下に絞り込み」を判断する

| # | 氏名 | 状態 | 投入判断 | 備考 |
|---|---|---|---|---|
| 1 | flux@cursorvers.com | admin | **必須** | smoke test + 緊急対応用 |
| 2 | 大田原正幸 | Founder | **必須** | dogfood |
| 3 | 香西杏子氏 | Active 顧問 | **必須** | 顧問契約 Active、A7 直配布対象 |
| 4 | 長谷川拓也氏 | Lead | 任意 (5/19 後) | A8 タイミング次第。事前投入しておいて A8 送信時に有効化する手も可 |
| 5 | 大田原絵美氏 | 代取 | 任意 | dogfood、配布判断ではない |
| 6 | 梶田医院千葉 | Pro 契約 | 任意 (別途) | `PRO_USERS` への投入も検討 (memory `project_cursorvers_pro_tier_funnel.md`) |

---

## 6. 後回し / 別 run 案件 (design doc 完納済み、実装は trigger 待ち)

本 critical path 外の全項目について、**実装前の設計 doc は完納済**。各 doc は trigger 到達時に「次 session で実装着手するための blueprint」として機能する。

### 6.1 Design doc 完納済 (実装 trigger 待ち)

| 項目 | doc | 規模 | Trigger |
|---|---|---|---|
| P0-2 iOS Safari camera 互換性 | [docs/p0-2-ios-safari-camera.md](docs/p0-2-ios-safari-camera.md) | 3h | 配布前 (5/15-5/19) に実機 audit |
| P0-5 OAuth token silent refresh | [docs/p0-5-oauth-silent-refresh.md](docs/p0-5-oauth-silent-refresh.md) | 4h | 配布後 1 週間以内に再ログイン頻度高なら |
| BS-1+BS-2+BS-5 Resilience (offline + retry) | [docs/resilience-offline-retry.md](docs/resilience-offline-retry.md) | 4h | 検証 1 週で offline event 観測 |
| P1-2+P1-3+BS-4 Observability + quarterly review | [docs/observability-plan.md](docs/observability-plan.md) | 3h | 配布**前** (Sentry 導入) |
| P2-2+P2-3 Tier B implementation (gateway 接続) | [docs/tier-b-implementation-plan.md](docs/tier-b-implementation-plan.md) | 6-10h | 検証完了後 + 顧問要望時 |
| BS-3 localStorage pro_tier threat model | [docs/security-pro-tier-storage.md](docs/security-pro-tier-storage.md) | 4h | Stripe webhook 着手判断 |
| BS-6 CI artifact retention policy | [docs/ci-artifact-policy.md](docs/ci-artifact-policy.md) | 1-2h | origin 化 + GitHub Actions 導入時 |
| B4 Notion ↔ INVITE_ALLOWLIST 同期 | [docs/notion-allowlist-sync.md](docs/notion-allowlist-sync.md) | 2h | invite 30 件超 / 月次同期負担増 |
| B5 Vercel custom domain (capture.cursorvers.com) | [docs/custom-domain-setup.md](docs/custom-domain-setup.md) | 1h | 配布範囲拡大判断 |
| B6 Gateway 接続 SOP | [docs/gateway-integration.md](docs/gateway-integration.md) | (env 投入のみ) | Tier B 本実装後 |

### 6.2 doc 不要 / 環境依存

- **A5**: Vercel KV 有効化 — fallback で十分動作、後で必要時 enable
- **C 全体 (cursorvers-codex-gateway Phase B-2+)**: 別 FUGUE run、別 repo (`~/Dev/cursorvers-codex-gateway/`)、実 user フィードバック後
- **OAuth verification 申請**: Testing mode 100 user 上限まで余裕、超過時に再評価

### 6.3 着手優先順 (配布前 → 検証中 → 検証後)

1. **配布前 (5/15-5/19)**: P0-2 iOS Safari audit + P1-2 Sentry 導入 = 計 ~6h
2. **検証中 (5/20-6/12)**: P0-5 OAuth refresh (頻度を見て判断) + BS-1+2+5 Resilience (offline event 観測時)
3. **検証完了後 (6/13-)**: B4/B5/B6 実装 + Tier B + OAuth verification + BS-3 security + BS-6 CI

---

## 7. 検証フェーズ Exit 条件

以下を全て満たした段階で「invite-only 検証フェーズ完了」とし、次 phase (Phase C 本格化 / 公開リリース判断 / scale-up) へ遷移する:

- [ ] 香西氏が 1 回以上 撮影→upload を完遂 (**deadline: 2026-06-05**、メール A 送信から 2 週間)
- [ ] 香西氏からフィードバック (定性) を 1 件以上 受領 (**deadline: 2026-06-12**、初回 upload から 1 週間後)
- [ ] dogfood で 1 週間以上 daily 撮影 (deploy 完了から起算)
- [ ] OAuth Testing mode 内のエラー率 < 5% (smoke test 含む、deploy 完了から 1 週間計測)
- [ ] 長谷川氏 (5/19 面談後) の判断: 配布 or 非配布、いずれかに確定 (**deadline: 2026-06-02**、面談から 2 週間)

**deadline 超過時の扱い**: Exit 条件が **永遠未達成** にならないよう、deadline を過ぎた未完項目は「配布見送り / 非配布」として確定 Close する。永続検証は user 時間を蝕む。判断材料が不足する場合は「データ不足のため判断保留 → 次サイクル (Q3) 持ち越し」も可。

---

## 8. 関連 doc / memory

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

## 9. 履歴

履歴は **`git log -- OPERATIONS.md` で完全追跡可能** (本 doc を modify した commit は必ず本 file の差分を含む)。
従来この場所にあった日付別 table は git log と redundant のため削除した (2026-05-14、FUGUE 3-agent vote の OpenCode + GLM 提案で採択)。

主要な節目だけ補注:

- 初出: 2026-05-13 (FUGUE multi-agent B3 採択、commit `bc52cda`)
- 主要拡張: critic 合議反映 (commit `40b0934`) → P0-1+P0-3+P0-4 hardening (commit `af429b3`) → critique 2026-05-14 反映 (commit `f2f75d9`)
- 後続 doc: `docs/security-pro-tier-storage.md` `docs/ci-artifact-policy.md` (2026-05-14、threat model + CI policy)
