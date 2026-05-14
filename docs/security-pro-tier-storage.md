# Security: localStorage `pro_tier` Threat Model (BS-3)

**Date**: 2026-05-14 (FUGUE 3-agent vote 3/3 採択、最高 confidence)
**Owner**: 大田原正幸 (Cursorvers Founder)
**Severity (current phase)**: Low / **Severity (Stripe 連動後)**: High
**Status**: design + threat model のみ。実装は P3 (Stripe webhook GA 時)

---

## 1. 現状

`app/lib/tier.ts` (spec.md §B4 N9 / commit `e146026` S11) で:

- `localStorage:pro_tier` を **client-side flag** として保持
- admin 環境変数 `NEXT_PUBLIC_PRO_USERS=email1,...` でも tier 昇格可能
- `middleware.ts` 内で server-side に `PRO_USERS` env を見て tier 判定
- Stripe webhook は **stub のみ** (spec.md N9、本実装は Phase B Q4 以降)

## 2. 攻撃面

### 2.1 招待制 (現フェーズ) では脅威小

- 配布対象 = 香西氏 / 長谷川氏 / 内部 dogfood で改ざんインセンティブほぼゼロ
- pro_tier client flag を triple したところで提供サービスは同じ (Tier B は stub、有償機能なし)
- middleware が server-side `PRO_USERS` env 経由でも tier 判定するため、最終 authoritative source は **server**

### 2.2 Stripe 連動後 (Phase B Q4+) は High

将来「pro tier = ¥10,000/月」「ConfigA = ¥75,000 (梶田医院千葉特別契約)」が GA すると:

- 攻撃者が `localStorage.setItem('pro_tier', 'pro')` で UI 上を pro として表示できる
- そのまま server-side が信頼すると、課金スキップ + 有償機能アクセス が成立
- 影響: Cursorvers 収益毀損 + 他 pro user への信頼失墜

## 3. 防御方針 (Stripe 連動着手時に実装、本 doc は設計のみ)

### 3.1 必須 (Phase B Q4 着手前 gate)

1. **server-side 認可を SoT 化**
   - `localStorage:pro_tier` は **UI 表示用 hint のみ** に降格 (キャッシュ最適化)
   - 有償機能 API endpoint (Tier B 系) は毎回 server-side で tier を再評価
   - 評価ロジック: `(Stripe customer.subscriptions.active == true) || (email in NEXT_PUBLIC_PRO_USERS env)`

2. **Stripe webhook を signature 検証付きで Edge Function 化**
   - `STRIPE_WEBHOOK_SECRET` で `Stripe-Signature` header 検証
   - `customer.subscription.updated` / `customer.subscription.deleted` を Vercel KV に AES-256-GCM 暗号化 persist
   - KV から server-side が tier を引く (権威 source)

3. **client flag と server flag の divergence を観測**
   - 認可エラー時に「client は pro なのに server は free」をテレメトリで観測
   - 一定閾値超で alert (Sentry / OpenObserve)、改ざんを早期検知

### 3.2 推奨 (Phase B Q4 + 1 sprint)

4. **`pro_tier` を localStorage ではなく httpOnly signed cookie** に移行
   - 改ざん困難、middleware が signed cookie を decode して tier 判定
   - localStorage の値は読み出し専用 mirror (UI 反応速度のみ)

5. **rate-limit による試行コスト増加**
   - 1 user あたり tier-related endpoint に 100 req/h limit
   - 攻撃者の brute-force / 試行錯誤を抑止

### 3.3 任意 (regulatory 要件次第)

6. **audit log** — 各 user の tier 状態変化と Stripe イベントを 30 日間保持

## 4. 検証フェーズ (現在) では何をしないか (明示)

- ✗ `pro_tier` を localStorage から削除
- ✗ Stripe webhook の本実装
- ✗ Sentry 等のテレメトリ導入

**理由**: 招待制で攻撃面が限定的、Tier B 自体が stub、有償機能未提供、検証完了後 (Q3 以降) に Stripe 連動とまとめて実装する方が単発で完結

## 5. 着手 Trigger (P3 → P0 への昇格条件)

以下のいずれかが成立した時に、本 doc を P0 として再 prioritize する:

- [ ] Stripe webhook 本実装の着手判断 (Phase B Q4)
- [ ] 有償機能 (Tier B 実稼働、advisor GA 等) を 1 つでも提供開始
- [ ] OAuth verification 申請 (100 user 突破)
- [ ] 任意の pro user が ¥1 でも実支払い

## 6. 関連

- [spec.md §B4 N9](../spec.md) (tier flag 設計)
- [app/lib/tier.ts](../app/lib/tier.ts) (現実装、client-side toggle)
- [middleware.ts](../middleware.ts) (server-side tier 判定)
- [OPERATIONS.md §6](../OPERATIONS.md) (Phase B Q4 後送り項目)
- memory `cursorvers_pro_tier_funnel.md` (Pro tier 標準 / 特別契約)
- memory `stripe_webhook_400_diagnosis.md` (Stripe webhook 運用知見)
- memory `feedback_supabase_no_verify_jwt.md` (webhook deploy 注意)

## 7. ステータス

| Phase | 内容 | 期間 |
|---|---|---|
| Current | threat model doc 作成 (本 file) | 完納 |
| Phase B Q4 着手前 | §3.1 (必須) を実装 | TBD |
| Phase B Q4 + 1 sprint | §3.2 (推奨) を実装 | TBD |
| Regulatory 要件発生時 | §3.3 (任意) を実装 | TBD |
