# Cursorvers Capture — ベータ配布キット

ベータ期間中のテスター招待・onboarding 一式。
**ベータ版 (無料・販売前)** につき特商法表記・Stripe 決済は未配線です。

---

## 1. 招待 URL の発行 (Masa 用)

```bash
# 1 アカウント向け 60 日試用 URL
node scripts/issue-invite.mjs \
  --cookie 'flux@cursorvers.com.<HMAC>' \
  --note '〇〇税理士法人 様' \
  --max-uses 1 \
  --expires 2026-08-20
```

cookie の取り方: capture.cursorvers.jp にサインインしてある自分のブラウザで DevTools → Application → Cookies → `gdrive_email` の値をコピー。

---

## 2. 招待メール文面テンプレ

### A. 税理士法人 向け (BtoBtoC)

```
件名: [Cursorvers Capture] ベータ版のご招待

〇〇税理士法人 ご担当者様

平素より大変お世話になっております。
Cursorvers Inc. 大田原 (flux@cursorvers.com) です。

弊社が開発中の、領収書・名刺・メモ撮影 → Google Drive 自動整理アプリ
「Cursorvers Capture」のベータ版へご招待します。

▼ アクセス URL (60 日間有効)
https://capture.cursorvers.jp/?invite=<TOKEN>

▼ 使い方
1. iPhone / Android のブラウザで上記 URL を開く
2. Google でサインイン (お客様の Google アカウント)
3. 設定ページで保存先の Drive フォルダを選択
4. 「撮影する」で領収書等を撮影 → 自動で Drive に保存

▼ 本アプリの位置づけ
- 整理補助ツールです。電子帳簿保存法のスキャナ保存要件は満たしません。
- 領収書等の紙原本は別途保管をお願いします。
- 税務申告に用いる正式な電子保存が必要な場合は freee 受領 BOX 等を併用してください。

▼ ベータ期間中
- 無料でご利用いただけます (試用 60 日)
- 動作不具合・ご要望は flux@cursorvers.com までお気軽に
- 商用ローンチ後の利用料・契約条件は別途ご案内します

ご検証よろしくお願いいたします。

----
Cursorvers Inc.
大田原 (Founder)
flux@cursorvers.com
```

### B. 一般テスター 向け

```
件名: [Cursorvers Capture] ベータ版テスター招待

〇〇 様

開発中の領収書・名刺・メモ整理アプリ「Cursorvers Capture」の
ベータ版テスターに、ぜひご協力ください。

▼ アクセス URL
https://capture.cursorvers.jp/?invite=<TOKEN>

▼ 使い方 (2 分)
1. iPhone Chrome / Safari で上の URL を開く
2. Google でサインイン
3. 保存先 Google Drive フォルダを選択
4. 「撮影する」で領収書を撮影
   → AI が自動で書類種別・店名・金額・日付を読み取り、Drive に保存

▼ ホーム画面追加 (任意)
iPhone Safari で開いて、共有 (□+↑) → 「ホーム画面に追加」
これで普通のアプリのように使えます。

▼ ベータ期間
無料・60 日間
不具合 / 改善要望は flux@cursorvers.com まで

よろしくお願いします。

大田原 (Cursorvers Inc.)
```

---

## 3. クライアント onboarding チェックリスト

テスターが詰まりそうな箇所を先回りで案内:

| 詰まりやすい場所 | 案内 |
|---|---|
| iPhone でホーム画面追加できない | **Safari で開いてから** 共有 → ホーム画面に追加。Chrome ではこの選択肢が出ません |
| サインインできない | ポップアップブロック OFF を確認 (設定 → Safari/Chrome) |
| サインインしているのに「未認証」と出る | 設定 → 再認可ボタン |
| フォルダが選べない | 「Drive から選ぶ」ボタンを使う (URL コピー不要) |
| 撮った画像が Drive に出ない | 設定でフォルダが選択済みか確認、ネットワーク接続確認 |
| 「Drive から選ぶ」ボタンがない | キャッシュ古い → 履歴削除またはシークレットタブ |

---

## 4. FAQ (テスター向け)

**Q. 撮った領収書は本物として税務処理に使えますか?**
A. いいえ。本アプリは電子帳簿保存法に対応していません。
紙原本は別途保管してください。本アプリは「税理士に渡す前の整理」
を補助するツールです。

**Q. 私の領収書は Cursorvers のサーバに保存されますか?**
A. 画像本体は保存されません。あなたの Google Drive に直接アップロード
されます。AI 解析は Gemini API (Google 社) に一時送信されますが、
弊社サーバには残りません。

**Q. ベータ後の利用料は?**
A. 未定です。決まり次第ご案内します。ベータ期間は無料です。

**Q. 解約は?**
A. 設定 → サインアウト + 端末データ消去 で全データ削除。
Drive 上のファイルは残ります (あなたの所有物)。

---

## 5. Masa 側オペレーション

| 局面 | アクション |
|---|---|
| 招待発行 | `scripts/issue-invite.mjs` |
| 利用状況確認 | CF Dashboard → KV → INVITE_KV → email:* キーの数 |
| 試用延長依頼 | KV を直接編集 (`wrangler kv:key put`) で trial_ends_at を未来に書き換え |
| 不具合報告 | flux@cursorvers.com 受信 → Phase で対応 |
| データ削除依頼 | KV から `email:<email>` 削除 + ユーザーに Drive 側削除を依頼 |

---

## 6. ベータ卒業時に必要な追加作業 (備忘)

商用ローンチに移る前に:
- [ ] Phase 13b: Stripe Checkout
- [ ] Capture Standard 価格決定
- [ ] 特商法表記
- [ ] 利用規約の改訂 (有償版条項)
- [ ] Phase 16: 残セキュリティ強化 (atomic claim, admin RBAC 等)
- [ ] 弁護士レビュー (Cursorvers 顧問契約 playbook 経由)
