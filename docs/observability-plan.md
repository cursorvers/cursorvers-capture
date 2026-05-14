# Observability Plan: Error Tracking + Metrics + Quarterly Review (P1-2 + P1-3 + BS-4)

**Date**: 2026-05-14 (FUGUE 3-agent vote、Wave 2 W2-1 採択、GLM 主要推奨)
**Status**: plan doc only。実装は検証フェーズ並走 (5/19 配布後 1-2 週間)
**Scope**: client error capture + upload metrics + Vercel quota monitor + Google API spec drift quarterly review

---

## 1. なぜ今 plan を書くか

検証フェーズ (5/19 配布開始 → 6/12 まで) で観測すべきは:

- 香西氏 / 長谷川氏 / 内部 dogfood の **実 user 行動** (撮影/upload/エラー発生率)
- screenshot from testers では不十分、**自動キャプチャ可能なテレメトリ** が必要
- Vercel free tier の **帯域・ビルド時間制限** が突然死すると検証中の信頼を毀損

→ 配布開始**前** に最小限の telemetry を導入し、検証中に signal を蓄積する。Sentry は 14 日 free trial / $26/月 で start 可能、本格化判断は trial 終了時。

---

## 2. P1-2: Error tracking 導入

### 2.1 候補比較

| 候補 | Cost (10k events/mo) | Easy setup | PWA support | Cursorvers 既存使用 |
|---|---|---|---|---|
| **Sentry** | $26/月 (Team Plan) | ✓ npm install + DSN 設定 | ✓ Browser SDK 完備 | memory `sentry-heal` skill 既存 / Sentry MCP scaffold あり |
| **OpenObserve** | self-hosted で $0、cloud $9/月~ | △ self-host 設定要 | ✓ | (なし、新規) |
| **LogRocket** | $99/月 (Free 1k sessions/月) | ✓ | ✓ + Session Replay | (なし) |
| **Rollbar** | $19/月 | ✓ | ✓ | (なし) |
| **PostHog** | $0 (1M events/月 free) | ✓ | ✓ + product analytics | (なし、検討余地大) |

**採択候補 #1: Sentry** (既存 Cursorvers skill との整合、user の learning curve ゼロ)
**採択候補 #2: PostHog** (free tier 圧倒的、product analytics 兼用、招待制 100 user では event 数余裕)

→ **Sentry を default**、検証フィードバックで「event volume 大」「機能不足」が判明したら PostHog 移行。

### 2.2 Sentry 導入 slice (検証開始前 2-3h)

| Slice | 内容 | 規模 |
|---|---|---|
| α-1 | `@sentry/nextjs` install + `sentry.client.config.ts` / `sentry.server.config.ts` 設定 | 30 min |
| α-2 | DSN を Vercel env (`SENTRY_DSN`) に投入、source map 自動 upload | 30 min |
| α-3 | カスタム error boundary を `app/error.tsx` `app/global-error.tsx` に組み込み | 30 min |
| α-4 | 既存 `console.warn`/`console.error` のうち重要なものを `Sentry.captureMessage` に置換 (`codex-app-server.ts` の stub warning 等) | 30 min |
| α-5 | `__tests__/sentry.test.ts`: Sentry init を mock、build 阻害ゼロを確認 | 30 min |
| α-6 | privacy policy §4 「Edge Middleware では完全な署名検証を省略」付近に「Sentry error tracking 利用、PII redaction 設定」追記 | 15 min |

合計 ~3h。configure 重視、本実装は schema 不変。

### 2.3 privacy / 法務との整合

Sentry に送信される data:

- error message + stack trace
- user agent (browser, OS, version)
- URL (pathname only、query string は scrub)
- breadcrumbs (直前の click / network call)

**送信してはいけない**:
- email address (gdrive_email cookie 等)
- Drive folder ID (query string の `?folder=` は scrub)
- access_token (Bearer token、redact)

→ `Sentry.init({ beforeSend: (event) => scrubPII(event) })` で送信前 redaction。privacy §5 「当社が契約するクラウド処理基盤・モデル提供者」記載に Sentry を追加。

### 2.4 計測する KPI

| Metric | 期待値 (検証フェーズ) | trigger |
|---|---|---|
| **JS error rate** | < 1% of sessions | > 5% で要調査 |
| **upload success rate** | > 95% | < 90% で P0 incident |
| **silent token refresh success rate** | > 95% | < 80% で P0-5 緊急対応 |
| **camera permission grant rate** | > 80% (1st prompt 後) | < 50% で UX 改善要 |
| **stub fallback hit rate** | 100% (Tier B 未稼働の現状) | gateway 接続後は < 5% を目標 |

---

## 3. P1-3: Vercel free tier 監視

### 3.1 Vercel free tier 制限 (Hobby plan 2026)

| Resource | Limit | gdrive-uploader 想定使用量 |
|---|---|---|
| Bandwidth | 100 GB/月 | 招待 10 user × 月 100 撮影 × 1 MB = 100 MB → 0.1% 余裕 |
| Build minutes | 6000 分/月 | 月 30 deploy × 2 分 = 60 分 → 1% 余裕 |
| Serverless function execution | 100 GB-hours/月 | `/api/me` 軽量、月 10k req × 100 ms = 0.3 GB-hours → 余裕 |
| Edge function | 500k requests/月 | middleware が全 path で動作、招待制で月 10k req → 余裕 |
| Function concurrency | 1000 | 招待制で issue にならず |

→ **検証フェーズ (10-20 user) は全リソース 1-3% 程度で余裕**。

### 3.2 監視方法

Vercel Dashboard に **Usage** tab があり、各 resource の月次グラフを確認可能。

検証中の運用:

- 週 1 回 user (大田原氏) が Vercel Dashboard を visit、各 resource < 10% を確認
- 50% 到達したら Pro plan ($20/月) 検討 = **Pro plan 移行 trigger**
- 80% 到達は incident、即時調査

### 3.3 自動 alert (Phase β 候補)

Vercel API + cron で監視自動化:

```ts
// (Phase β、検証フェーズ完了後 / origin 化後の GitHub Actions cron)
// GET /v3/projects/{id}/usage
// 50% / 80% / 100% で Slack or email alert
```

→ 検証フェーズは手動週次で十分。

---

## 4. BS-4: Google Drive API Spec Drift Quarterly Review

### 4.1 なぜ quarterly か

Google API は 半年-1 年単位で deprecation / 新 endpoint / scope の細分化 がある。Drive API は比較的安定だが、過去事例:

- 2020: `drive` scope の sensitive 化 (verification 必須化)
- 2023: `picker` scope の deprecation
- 2024: file picker UI の design 変更
- 2025: OAuth consent screen の表示文言変更 (「未確認のアプリ」の表示条件)

→ 検証フェーズ中の **未確認のアプリ表示が変化** すると配布メール A の文言が時代遅れになる risk あり。

### 4.2 Quarterly Review プロセス (本 doc で institutionalize)

毎四半期 1 回 (1/15 / 4/15 / 7/15 / 10/15)、user (大田原氏) または FUGUE session で:

#### Step 1: 公式 docs / changelog を確認

- https://developers.google.com/drive/api/release-notes
- https://developers.google.com/identity/release-notes
- https://workspace.google.com/blog/feed/ (admin 系 update)

#### Step 2: 既存 doc / 配布メールへの影響を audit

- privacy/page.tsx の表現が古くなっていないか
- terms/page.tsx の文言
- DISTRIBUTION_EMAIL_DRAFT.md §A の「Google の審査前」記述
- DEPLOY.md の GCP Console 手順

#### Step 3: 影響あれば PR / commit で更新

#### Step 4: `~/.claude/projects/-Users-masayuki-Dev/memory/` に「YYYY-QN drive API review」memo を残す

### 4.3 トリガー設定 (cron 候補、Phase β で実装)

```bash
# Mac mini の crontab に追加候補
0 9 15 1,4,7,10 * mobile-nl review drive-api-spec
```

→ `/canon` skill 経由で自動 reminder。

### 4.4 検証フェーズ中の即時 review

検証フェーズの 1-2 週目で **1 回だけ** Drive / GIS docs を確認し、現状 baseline を OPERATIONS.md に追記する。これを Q4 2026 review (10/15) の比較対象にする。

---

## 5. 実装 / 着手スケジュール

| Phase | Trigger | Content |
|---|---|---|
| Current (2026-05-14) | — | 本 plan doc 完納 |
| Phase α (5/15-5/19) | 配布開始 **前** | Sentry α-1 〜 α-6 = ~3h、配布開始時には telemetry 入り |
| Phase β (5/20-6/12) | 検証フェーズ並走 | 週次 Vercel quota チェック、Sentry data 蓄積 + dashboard 確認 |
| Phase γ (6/13-) | 検証完了後 | KPI retrospective、Pro plan 移行判断、PostHog 等 product analytics 追加検討 |
| Quarterly (7/15, 10/15, 1/15) | 自動 cron (Phase β で実装) | Google API spec drift review |

---

## 6. リスク

| Risk | 影響 | 対策 |
|---|---|---|
| Sentry が PII を漏らす | 法務違反 | beforeSend で redaction、privacy §5 への明記、月次 audit |
| 検証中に Vercel quota 突破 | サービス断 | 50% 閾値で Pro plan upgrade、emergency 連絡先 |
| Sentry $26/月 が ROI 合わない | 経費無駄 | 14 日 trial で event volume を実測、PostHog (free) 移行可能 |
| Google API change を見落とす | UX デグレ | quarterly review プロセス確立 (本 doc 4 章) |
| privacy 文言 update がリリース後 | 法務リスク | 配布直前に必ず privacy/terms を Google docs 最新と照合 |

---

## 7. 関連

- [docs/security-pro-tier-storage.md](security-pro-tier-storage.md) (PII boundary、Sentry redaction と整合)
- [docs/p0-5-oauth-silent-refresh.md](p0-5-oauth-silent-refresh.md) (refresh success rate を Sentry で計測)
- [docs/resilience-offline-retry.md](resilience-offline-retry.md) (offline event を Sentry に送る)
- [OPERATIONS.md](../OPERATIONS.md) §6 (本 doc 完納後に pointer 追加)
- memory `sentry-heal` skill (Cursorvers 既存)
- memory `Sentry MCP CONDITIONAL production-ready scaffold 完成` (handover index)
- memory `secrets_brushup_2026_04_20` (Sentry DSN は Keychain `fugue/sentry-dsn` 候補)

## 8. ステータス

| Phase | Status | Note |
|---|---|---|
| Plan doc | ✅ 完納 (本 file) | — |
| Sentry α-1 〜 α-6 | ⏳ Pending | 5/15-5/19 で 3h 確保 |
| Vercel quota 週次 review | ⏳ Pending | 5/19 配布開始から user 運用 |
| Drive API quarterly review | ⏳ Pending | 7/15 が初回、自動 cron は Phase β |
