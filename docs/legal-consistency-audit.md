# Legal Consistency Audit (P0-3)

**Date**: 2026-05-14 (FUGUE multi-agent vote: P0-3 採択 3/3 票)
**Scope**: `privacy/page.tsx` ↔ `terms/page.tsx` ↔ `DISTRIBUTION_EMAIL_DRAFT.md` の 3-way 整合
**Aim**: invite-only 配布前の文言整合性確認、誤誘導・過剰約束・記載漏れの除去

---

## 1. 整合性 audit 結果

### 表記揺れ (採択して統一)

| 項目 | privacy/page.tsx | terms/page.tsx | DISTRIBUTION_EMAIL (polish v2) | 採択 |
|---|---|---|---|---|
| Tier B 経路の名称 | "Codex App Server 経由の一時処理" (§3) | (記載なし) | "当社が運営する別サーバー" | privacy の technical 表記を保持し、配布メール側で **「Codex App Server (当社が運営する別サーバー)」** と注釈併記する形に統一 |
| サービス段階 | "初月 experimental" (§前文) | "experimental (実験的サービス)" (§前文) | (記載なし) | 配布メールには明示しないが、OAuth 同意画面の「未確認のアプリ」と暗黙整合 |
| データの流れ (現状) | "クライアントから Google Drive API へ直接アップロード...画像バイナリが当社サーバーを経由して恒常的に保存されることはありません" (§2) | (記載なし) | "撮影画像は香西先生ご自身の Drive 内に保存され、当社サーバーには一切送信されません" (§A) | 整合済。配布メール側の表現が user-friendly でよい |
| 削除手段 | "Google アカウント側の権限解除、本アプリ設定からのサインアウト、端末データ消去" (§6) | (記載なし) | (記載なし) | 配布メールには追記する価値あり (clinic 系顧問の「データ削除したい」要望対応) |

### terms §2 と配布メールの整合 (要対応)

terms `app/terms/page.tsx` §2 「AI 機能とモデレーション」 に:

> Medical / Legal 等の高リスク判断への利用は避けてください

の記載がある。配布対象 = clinic 関係者 (香西氏 = ハートキッズライフリンク代表 / 長谷川氏 = 結のぞみ病院 診療部長)。
**「臨床診断・診療行為そのものへの利用は意図していない」旨を配布メールでも先に告知** することで:

- 「診療補助ツール」と誤認されるリスク回避
- terms §2 と配布段階の説明が一貫
- 顧問先での legal 受容性向上

→ **配布メール A / B に 1 文追加** (本 commit で実施)

### privacy §3 KV 暗号化条項の確認

privacy §3 で:

> 当該値は AES-256-GCM で暗号化されたうえで保存し、利用可能な鍵は `KV_ENCRYPTION_KEY` または `COOKIE_SECRET` から導出

これは S12 で実装済 (handover 記載)。`.env.local` 雛形でも `KV_ENCRYPTION_KEY` を pre-generate していることと整合済 → OK

### privacy §4 「Edge Middleware では完全な署名検証を省略」の取扱い

privacy §4 で:

> Edge Middleware では完全な署名検証を省略し、電子メール部分の抽出のみ行う場合があります。確実な検証は Node.js 環境の API で行います。

→ user 向けの記載としては技術詳細寄りだが、HMAC 検証実装 (`middleware.ts` の `extractEmailFromSignedCookie`) と整合済。**保持** (透明性の観点でむしろ加点)

### privacy §5 第三者提供 と Tier B 未稼働の整合

privacy §5:

> AI 処理を行う際は、当社が契約するクラウド処理基盤・モデル提供者へ必要最小限のデータが送信される場合があります

これは Tier B (OCR/音声/advisory) を有効化した場合の **将来仕様**。配布メール A polish v2 では:

> 現時点ではこれらの機能は **未稼働** で、画像の流れは「端末 → Google Drive のみ」

と現状を明示済 → 整合 OK (privacy は将来 / メールは現状を separate に説明する形)

---

## 2. 本 sweep で実施する修正 (本 commit に含む)

1. **配布メール A / B**: 「臨床診断・診療行為そのものへの利用は意図していない」旨を 1 文追加 (terms §2 との整合)
2. **配布メール A**: 「別サーバー」表記を「Codex App Server (当社が運営する別サーバー)」に統一 (privacy §3 との注釈整合)
3. **配布メール A**: 「データ削除手段」を 1 行追加 (privacy §6 との整合、clinic 系顧問対応)

## 3. 本 sweep で **実施しない** 項目 (out-of-scope or deferred)

- **terms 全面リライト**: 現状の「Medical / Legal 等の高リスク判断への利用は避けて」記述は妥当、変更不要
- **privacy 全面リライト**: 「初月 experimental」「processor/controller」「KV 暗号化」「Cookie 署名」記述は妥当、変更不要
- **「未確認のアプリ」表示の Google 2026 仕様キャッチアップ**: 別タスクで quarterly review プロセス候補 (BS-4)
- **i18n** (英語版 privacy/terms 等): 日本語 invite-only では不要、グローバル展開時の P3

## 4. Audit 結果まとめ

- **法務 critical 不整合**: 0 件 (現状の privacy/terms/配布メール は基本整合)
- **採択する整合追加**: 3 件 (上記 §2)
- **保持判断 (修正不要)**: 5 件 (privacy §3 表記 / privacy §4 透明性 / privacy §5 将来仕様 / terms §2 / terms §3 AS IS)
- **将来 review 候補**: 1 件 (Google 「未確認のアプリ」表示仕様の定期確認)

→ verdict: **APPROVE (修正 3 件適用後)**

---

## 5. 参照

- [app/privacy/page.tsx](../app/privacy/page.tsx) (現行 privacy policy)
- [app/terms/page.tsx](../app/terms/page.tsx) (現行 terms)
- [DISTRIBUTION_EMAIL_DRAFT.md](../DISTRIBUTION_EMAIL_DRAFT.md) (polish v2)
- [OPERATIONS.md](../OPERATIONS.md) §7 Exit 条件
- memory `feedback_subsidy_phrasing_ban` / `feedback_advisory_initial_free_phrasing` / `feedback_medgov_positioning`
