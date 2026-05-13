# 配布メール下書き

2026-05-13 FUGUE multi-agent polish v2 (Codex/GLM/OpenCode 合議で B2 採択)。
件名・本文の tone は Cursorvers の advisory 文化 (落ち着いた医療向け) に合わせている。
技術用語 (Codex App Server / stub mode / allowlist) は臨床現場向けに平易化済。
補助金・無料試用の表現は含めない (memory `feedback_subsidy_phrasing_ban` / `feedback_advisory_initial_free_phrasing` 準拠)。

## ⚠️ user 投入箇所

- `<VERCEL_URL>`: Vercel deploy 後の URL (e.g. `https://gdrive-uploader.vercel.app/?folder=<DRIVE_FOLDER_ID>`)
- `<DRIVE_FOLDER_ID>`: 共有する Drive folder の ID (Drive で folder を「編集権限」で共有してから取得)
- `<署名>`: 送信者署名 (大田原正幸 / Cursorvers Inc.)

---

## A. 香西杏子氏 (ハートキッズライフリンク代表 / 顧問契約 Active)

```
件名: [Cursorvers] 写真アップローダー先行試用のご案内 (Google Drive 限定 / 招待 URL 制)

香西杏子 様

お世話になっております、Cursorvers の大田原です。
顧問契約発効に向けた準備の一環として、当社で内製している軽量 web アプリ
「Cursorvers Capture」(仮称) を、香西先生にも先行で試していただける状態に
整いましたのでご案内いたします。

【何ができるアプリか】
- スマートフォンのブラウザでカメラを起動し、撮影した写真をご自身の
  Google Drive の指定フォルダへ直接保存します
- 画像は当社サーバーを経由せず、香西先生の Drive にのみ保存されます
- アクセス権限は「自分が新規作成したファイル」のみに限定されており、
  既存ファイルの読み取りは行いません (Google のドキュメントで
  drive.file スコープとして定義されているもっとも狭い権限です)
- インストール不要、URL を開くだけでお使いいただけます

【ご利用 URL】
<VERCEL_URL>

【手順】
1. 上記 URL をスマートフォンで開く
2. Google アカウントで承認 (Drive への保存権限のみ求められます)
3. カメラで撮影 → 指定フォルダへ自動保存

【ご利用にあたって】
- 招待 URL 制のため、事前にご登録いただいた Google アカウントからのみ
  ご利用いただけます
- 現在は試用版 (Google の審査前) として運用しているため、OAuth 同意画面で
  「未確認のアプリ」と表示されます。これは Google のガイドライン上の通常表示で、
  審査申請は配布範囲が広がった段階で予定しています
- お気付きの点、改善ご要望は遠慮なくお知らせください

【データの取り扱い】
- 撮影画像は香西先生ご自身の Drive 内に保存され、当社サーバーには
  一切送信されません
- 将来、画像内のテキスト読み取り (OCR) や音声要約、相談チャット等の
  追加機能を有効化された場合に限り、対象データが当社が運営する別サーバー
  経由で処理されます。現時点ではこれらの機能は **未稼働** で、画像の流れは
  「端末 → Google Drive のみ」です

ご不明な点があればお気軽にお知らせください。

<署名>
```

---

## B. 長谷川拓也氏 (結のぞみ病院 / Lead) — 5/19 面談 **後** に送るか判断

```
件名: [Cursorvers] 先日のお礼と、参考までの写真アップローダーご案内

長谷川拓也 先生

お世話になっております、Cursorvers の大田原です。
先日 (5/19) はお時間をいただきありがとうございました。

ご相談いただいた LocalLLM 院内運用とは別の文脈ですが、当社で内製している
軽量 web アプリ「Cursorvers Capture」(仮称) を、参考までに先生にも
試していただける状態に整いましたのでご案内いたします。

(LocalLLM の話とは独立した内容ですので、ご興味があれば、ぐらいの温度感で
受け取っていただければ幸いです。お忙しい時期かと存じますので、
ご試用は時間に余裕がある時で構いません。)

【何ができるアプリか】
- スマートフォンのブラウザでカメラを起動し、Google Drive の指定フォルダへ
  撮影画像を直接保存します
- 画像は当社サーバーを経由せず、ご自身の Drive にのみ保存されます
- 招待 URL 制のため、事前にご登録いただいたアカウントからのみ
  ご利用いただけます

【ご利用 URL】
<VERCEL_URL>

【手順】
1. 上記 URL をスマートフォンで開く
2. Google アカウントで承認 (Drive への保存権限のみ)
3. カメラで撮影 → 指定フォルダへ自動保存

ご試用後、もしご感想があれば、面談時の LocalLLM 議論とあわせて
伺えれば幸いです。

<署名>
```

---

## C. 内部 (大田原氏 / 社員 / smoke test) — dogfooding 用

```
件名: [internal] gdrive-uploader prod deploy 完了 / smoke test 依頼

prod deploy 完了。

URL: <VERCEL_URL>
INVITE_ALLOWLIST 投入済 email: <list>
Vercel Project: <project-id>
HEAD: 6444547 (master)

smoke 項目:
1. ログイン → 撮影 → upload OK (自分の Drive `<DRIVE_FOLDER_ID>` を確認)
2. `?folder=<DRIVE_FOLDER_ID>` で folder pre-fill 確認
3. allowlist 外 email でログイン拒否 (access_denied) 確認
4. Tier B (OCR/audio/advisory) は stub mode warning がコンソールに出ることを確認
   (本実装は別 repo `~/Dev/cursorvers-codex-gateway/` で Phase B-2+ にて対応)
5. ブラウザ DevTools の Network で、画像本体が当社サーバーに送られていないことを確認
   (Google Drive endpoint へ直接 POST されているはず)

問題あれば本 Slack DM か、後で OPERATIONS.md (5/13 新設) の Checkpoint 表に追記。
```

---

## 送信タイミング (推奨 / 合議結果)

| 宛先 | 状態 | 送信判断 | 根拠 |
|---|---|---|---|
| dogfood (社内) | Active | deploy 直後 | smoke test を兼ねる |
| 香西杏子氏 | Active 顧問 | smoke 全 pass 後 | 顧問契約 Active、メール A は即送信判断可 |
| 長谷川拓也氏 | Lead | 5/19 面談**後**、温度感を見て判断 | 面談中に直接案内 or 後日メール B のいずれか |
| 梶田医院千葉 | Pro 契約 | 別途検討 (¥75,000 SKU との関係を整理してから) | Pro tier 特別契約と本 PWA の位置付けを先に整理 |

## v2 polish 変更点 (2026-05-13)

- 「Codex App Server」→「当社が運営する別サーバー」(技術内部名を消去)
- 「stub mode で動作しません」→「**未稼働** で、画像の流れは『端末 → Google Drive のみ』」(臨床向けに事実を明示)
- 「allowlist 方式」→「招待 URL 制」(技術用語を平易化)
- 「drive.file 限定」→「自分が新規作成したファイル」のみに限定 + drive.file の説明 (狭い権限であることを文脈で示す)
- 香西氏宛: OAuth Testing mode の説明を「Google の審査前」「審査申請は配布範囲が広がった段階で予定」と将来計画として柔らかく
- 長谷川氏宛: 「お忙しい時期かと存じますので、ご試用は時間に余裕がある時で構いません」を追加 (押し付け感ゼロ)
- 内部 dogfood: smoke 項目 5「画像本体が当社サーバーに送られていないことを Network で確認」を追加 (memory の `data flow` 主張を実体で検証)
- 全文を通して、補助金・無料試用・期限付き優遇等の表現を含めていない (memory `feedback_subsidy_phrasing_ban` / `feedback_advisory_initial_free_phrasing` 準拠)
