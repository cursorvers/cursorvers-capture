# INVITE_ALLOWLIST 投入ノート

`Cursorvers_Platform/ops/clients/ROSTER.md` (2026-05-13 時点) より。
ROSTER は PII 切り分けルールで **連絡先 email を格納しない** (`本ファイルは状態と SSOT 参照ポインタのみ`)。
よって email は Notion SSOT または別管理から user が手動投入する。

## 投入候補 (2026-05-13 ROSTER 抜粋)

| 氏名 | 状態 | SSOT (連絡先 source) | 投入判断 |
|---|---|---|---|
| 香西杏子 (ハートキッズライフリンク代表) | Active 2026-04-27 | Notion `34f6b8c0f0ac81838084cad2fd193290` | **投入推奨** (顧問契約済) |
| 長谷川拓也 (結のぞみ病院 診療部長) | Lead 2026-05-19 | `ops/opportunity-reviews/2026-05-19-yuinozomi-hasegawa-localllm.md` | 5/19 面談後に判断 (Lead 段階) |

## ROSTER 外で投入候補

- **梶田医院千葉**: ¥75,000 特別契約 (memory `cursorvers_pro_tier_funnel.md` 参照) — Pro tier の `PRO_USERS` slot へも投入検討
- **flux@cursorvers.com**: admin / smoke test 用に推奨
- **大田原正幸 / 大田原絵美**: dogfooding 用に検討 (任意)
- **Cursorvers 社員 / 業務委託**: 必要に応じて

## 投入形式

`.env.local` で:

```
INVITE_ALLOWLIST=email1@example.com,email2@example.com,email3@example.com
PRO_USERS=admin@cursorvers.com
```

- カンマ区切り、空白なし
- 大文字小文字は server 側で normalize される (middleware.ts で確認)
- Vercel Dashboard でも同じ value を Production scope に投入する

## GCP Test Users との同期

INVITE_ALLOWLIST に追加した email は、**全て GCP Console の OAuth consent screen の Test users にも追加**する必要がある (Testing mode の制約)。整合させないと OAuth ログイン時 `access_denied` になる。

100 ユーザー上限まで余裕あり。
