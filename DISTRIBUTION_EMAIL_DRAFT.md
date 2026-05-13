# 配布メール下書き

2026-05-13 FUGUE run pre-stage。user が手調整して送信する。
件名・本文の tone は Cursorvers の advisory 文化 (落ち着いた医療向け) に合わせている。

## ⚠️ user 投入箇所

- `<VERCEL_URL>`: Vercel deploy 後の URL (e.g. `https://gdrive-uploader.vercel.app/?folder=<DRIVE_FOLDER_ID>`)
- `<DRIVE_FOLDER_ID>`: 共有する Drive folder の ID (Drive で folder を「編集権限」で共有してから取得)
- `<署名>`: 送信者署名 (大田原正幸 / Cursorvers Inc.)

---

## A. 香西杏子氏 (ハートキッズライフリンク代表 / 顧問契約 Active)

```
件名: [Cursorvers] 写真アップローダー試用のご案内 (drive.file 限定 / 招待制)

香西杏子 様

お世話になっております、Cursorvers の大田原です。
顧問契約発効に向けた準備の一環として、当社で内製している軽量 web アプリ
「Cursorvers Capture」(仮称) を、香西先生にも先行で試していただける状態に
整いましたのでご案内いたします。

【何ができるアプリか】
- スマホブラウザでカメラを起動し、撮影した写真をご自身の Google Drive の
  指定フォルダへ直接アップロード
- バックエンドに画像を持たず、Drive (お客様のアカウント) のみで完結
- スコープは drive.file 限定 (既存ファイルを読み取らない)
- インストール不要、URL を開くだけ

【ご利用 URL】
<VERCEL_URL>

【手順】
1. 上記 URL をスマホで開く
2. Google アカウントで承認 (drive.file スコープのみ)
3. カメラで撮影 → 自動で Drive folder にアップロード

【注意事項】
- 招待制 (allowlist 方式) のため、事前にご登録いただいた Google アカウント
  からのみログイン可能です
- 試用版のため OAuth 同意画面で「未確認のアプリ」表示が出ます (Testing mode、
  Google ガイドライン上想定内)
- フィードバックは何でも歓迎いたします

【データの扱い】
- 撮影画像は香西先生ご自身の Drive 内に保存され、当社サーバーには一切経由しません
- アプリ内で OCR や AI 分析を有効化された場合のみ、その対象画像が当社の
  推論サーバー (Codex App Server、別途構築中) に一時送信されます
  (現時点では当該機能は stub mode で動作しません)

ご不明な点があればお気軽にお知らせください。

<署名>
```

---

## B. 長谷川拓也氏 (結のぞみ病院 / Lead) — 5/19 面談 **後** に送るか判断

```
件名: [Cursorvers] (面談時お見せした) 写真アップローダー試用のご案内

長谷川拓也 先生

お世話になっております、Cursorvers の大田原です。
先日 (5/19) はお時間をいただきありがとうございました。

ご相談いただいた LocalLLM 院内運用とは別文脈ですが、当社で内製している
軽量 web アプリ「Cursorvers Capture」(仮称) を、長谷川先生にも参考まで
試していただける状態に整いましたのでご案内いたします。

(LocalLLM の話とは独立した内容ですので、ご興味があれば、ぐらいの温度感で
受け取っていただければ幸いです。)

【何ができるアプリか】
- スマホブラウザでカメラを起動し、Google Drive の指定フォルダに自動アップロード
- バックエンド非経由、drive.file スコープ限定
- 招待制 (allowlist 方式)

【ご利用 URL】
<VERCEL_URL>

【手順】
1. 上記 URL をスマホで開く
2. Google アカウントで承認 (drive.file スコープのみ)
3. カメラで撮影 → 自動で Drive folder にアップロード

ご試用後、もしご感想があれば、面談時の LocalLLM 議論とあわせて伺えれば幸いです。

<署名>
```

---

## C. 内部 (大田原氏 / 社員 / smoke test) — dogfooding 用

```
件名: [internal] gdrive-uploader prod deploy 完了 / smoke test 依頼

prod deploy 完了。

URL: <VERCEL_URL>
INVITE_ALLOWLIST: <投入済 email list>

smoke 項目:
1. ログイン → 撮影 → upload OK
2. folder=xxx で folder pre-fill 確認
3. allowlist 外 email で拒否確認
4. Tier B (OCR/audio/advisory) は stub mode warning が出ることを確認

問題あれば GitHub issue で。
```

---

## 送信タイミング (推奨)

| 宛先 | 状態 | 送信判断 |
|---|---|---|
| dogfood (社内) | Active | deploy 直後 |
| 香西杏子氏 | Active 顧問 | smoke 完了後 |
| 長谷川拓也氏 | Lead | 5/19 面談**後**、本人の温度感を見て判断 |
| 梶田医院千葉 | Pro 契約 | 別途検討 (¥75,000 SKU との関係を整理してから) |
