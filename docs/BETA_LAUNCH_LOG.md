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
