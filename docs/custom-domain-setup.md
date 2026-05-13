# Vercel Custom Domain SOP (B5)

**最終更新**: 2026-05-13 (FUGUE multi-agent vote 後 / B5 採択)
**ステータス**: SOP only — user 任意のタイミングで実行
**対象**: gdrive-uploader を `https://capture.cursorvers.com` (案) で配布する場合の手順
**前提**: A1-A6 (DEPLOY.md) を全て完了し、Vercel 上の `https://<project>.vercel.app` が動作している

---

## 0. 着手判断

custom domain は **invite-only 検証フェーズでは optional**。以下に該当する場合のみ着手:

- 配布メール A/B の URL を覚えやすくしたい
- `*.vercel.app` の見栄え (顧問・clinic 向け) を避けたい
- 将来 OAuth verification 申請を見据えて canonical URL を確立したい

該当しない場合は本 SOP は skip し、`https://<project>.vercel.app` で運用継続。

---

## 1. ドメイン名の確定

| 候補 | 推奨度 | 理由 |
|---|---|---|
| `capture.cursorvers.com` | ★★★ | 製品名 (Cursorvers Capture) と subdomain が一致、URL 短い、用途明示 |
| `gdrive.cursorvers.com` | ★★ | 実装技術 (Google Drive) を露出 → 顧問向けは技術寄り過ぎ |
| `upload.cursorvers.com` | ★ | 機能寄り、Cursorvers Capture 製品名と乖離 |
| `cursorvers.com/capture` | — | path ベースは Vercel project 1 つでは難しい、別途 monorepo 化が必要 |

**推奨**: `capture.cursorvers.com` で確定。本 SOP 以下これを前提とする。

---

## 1.5 (推奨) 事前 TTL 短縮 (~24h 前)

DNS propagation の影響を最小化するため、custom domain 着手予定の **24 時間前** に、
DNS provider (Cloudflare / Route53 / お名前 等) で `cursorvers.com` の既存
recordss の TTL を **300 秒** (5 min) に下げておく。

これにより:
- 切替時の DNS 伝播がほぼ即時 (5-10 min)
- rollback 必要時の所要時間が短い (5-30 min vs 数時間)
- 失敗時 user 影響時間を最小化

24h 待たずに着手するなら本 step は skip 可能 (伝播が長引くだけでサービス断にはならない)。

## 2. 前提確認 (5 min)

```bash
# (a) cursorvers.com の DNS 管理権限を確認
#     - どこの registrar / DNS provider か (Cloudflare / Route53 / お名前.com 等)
#     - user が CNAME / A レコードを追加できる権限を持っているか
dig cursorvers.com NS
# 期待: provider の NS が表示される

# (b) Vercel project が存在するか
vercel projects ls
# 期待: gdrive-uploader (or 同等名) が見える

# (c) 現在の deploy が動作しているか
curl -I https://<your-project>.vercel.app/
# 期待: 200 OK or 308 (sign-in redirect)
```

---

## 3. Vercel 側で domain 追加 (3 min)

```bash
cd /Users/masayuki/Dev/gdrive-uploader

# domain を Vercel project に紐付け
vercel domains add capture.cursorvers.com

# 出力例:
# > Success! Domain capture.cursorvers.com added to project gdrive-uploader.
# > To configure DNS, set the following:
# >   CNAME  capture  cname.vercel-dns.com
# > Then come back and run: vercel domains verify capture.cursorvers.com
```

または Vercel Dashboard:

1. Project Settings → Domains
2. Add → `capture.cursorvers.com`
3. 表示される CNAME instruction をコピー

---

## 4. DNS 側で CNAME 設定 (5-10 min、provider 依存)

### Cloudflare (cursorvers.com が Cloudflare 管理の場合)

1. Cloudflare Dashboard → cursorvers.com → DNS → Records
2. Add record:
   - Type: **CNAME**
   - Name: `capture`
   - Target: `cname.vercel-dns.com`
   - Proxy status: **DNS only** (グレーの雲、橙色にしない)
   - TTL: Auto
3. Save

Proxy 有効化 (橙の雲) にすると Vercel 側の SSL handshake が失敗するため、必ず **DNS only**。

### Route53 (AWS)

1. Hosted zone → cursorvers.com → Create record
2. Record type: CNAME
3. Record name: `capture`
4. Value: `cname.vercel-dns.com`
5. TTL: 300

### お名前.com / Google Domains 等

各 dashboard の DNS 設定で同等の CNAME 追加。

---

## 5. propagation 待ち (5-30 min、最悪 48h)

```bash
# DNS 伝播確認
dig capture.cursorvers.com CNAME +short
# 期待: cname.vercel-dns.com.

# Vercel 側 verification
vercel domains verify capture.cursorvers.com
# 期待: Domain verified
```

伝播が遅い場合は cache flush:
- macOS: `sudo dscacheutil -flushcache`
- 別 resolver でも確認: `dig @8.8.8.8 capture.cursorvers.com`

**注意**: DNS provider が高 TTL 設定だった場合、世界中の resolver が
新 record を picking up するまで最大 **48 時間** かかる可能性あり。
§1.5 で事前 TTL 短縮を行わなかった場合に該当。配布メールに URL を載せて
送信する前に少なくとも `dig @8.8.8.8 / @1.1.1.1 / @9.9.9.9` の 3 resolver
全てで一致する CNAME が返ることを確認する。

---

## 6. SSL 証明書発行 (自動、1-5 min)

Vercel は domain verify 後に Let's Encrypt 証明書を自動取得。Dashboard の domain 行に「Valid Configuration」と緑表示されれば完了。

```bash
curl -I https://capture.cursorvers.com/
# 期待: 200 OK + 有効な TLS
```

---

## 7. GCP OAuth Authorized origins / redirect URIs を追加 (5 min)

**重要**: custom domain を追加したら、必ず GCP Console の OAuth Client 設定を更新。これを忘れると custom domain でログインしようとして `redirect_uri_mismatch` が出る。

1. https://console.cloud.google.com/ → APIs & Services → Credentials
2. OAuth 2.0 Client ID を開く
3. **Authorized JavaScript origins** に追加:
   - `https://capture.cursorvers.com`
4. **Authorized redirect URIs** に追加 (GIS implicit flow なら厳密には不要だが推奨):
   - `https://capture.cursorvers.com`
   - `https://capture.cursorvers.com/`
5. Save

既存の `https://<project>.vercel.app` origins は残す (rollback 用途、user が `.vercel.app` URL を別ブラウザで開くケースに対応)。

---

## 8. smoke test (5 min)

[OPERATIONS.md §3](../OPERATIONS.md) の A6 と同等手順を custom domain URL で再実行:

- [ ] `https://capture.cursorvers.com/` がロードする
- [ ] OAuth ログイン成功
- [ ] 撮影 → upload 成功
- [ ] allowlist 外 email で拒否
- [ ] DevTools Network で画像本体が当社サーバーへ送信されていない

---

## 9. 配布メール / OPERATIONS.md 更新

custom domain 切り替え後:

- [ ] [DISTRIBUTION_EMAIL_DRAFT.md](../DISTRIBUTION_EMAIL_DRAFT.md) の `<VERCEL_URL>` を `https://capture.cursorvers.com/?folder=<DRIVE_FOLDER_ID>` に置換
- [ ] [OPERATIONS.md](../OPERATIONS.md) §2 の参照 URL を更新
- [ ] 既に送信済みのメールがあれば、新 URL でフォローを送る判断
- [ ] (任意) 旧 `<project>.vercel.app` を Vercel Dashboard で 301 redirect 設定 (optional)

---

## 10. rollback (もし問題発生時)

```bash
# 1. Vercel から domain を切り離す
vercel domains rm capture.cursorvers.com

# 2. DNS の CNAME を削除 (cursorvers.com 側で)

# 3. 配布メールの URL を <project>.vercel.app に戻す
#    (新規送信のみ。既送信は気にしない、Vercel 側でしばらく動作する)
```

`<project>.vercel.app` は Vercel 側で常に有効なので、custom domain rollback しても サービス断にはならない (DNS 切り戻し以外)。

---

## 11. 既知の問題 / 注意

- **Cloudflare proxy (橙の雲) は NG**: SSL handshake が二重になり Vercel 側でエラー。DNS only (灰の雲) 厳守
- **Apex domain (cursorvers.com 直) は別手順**: A レコードで Vercel IP を指す必要があり、subdomain (`capture.`) より複雑。本 SOP は subdomain 前提
- **TTL 短くしてから移行 → 完了後に戻す**: DNS provider によっては TTL 1h+ で伝播が遅い。事前に 300s に下げると rollback 時の影響を小さくできる
- **OAuth verification 申請時**: custom domain を canonical にしたい場合は、申請前に確定。申請後の URL 変更は再審査になる可能性
- **マルチ環境**: preview deploy は自動的に `<branch>-<project>.vercel.app` になるので custom domain は production のみ

---

## 12. 関連 doc

- [DEPLOY.md](../DEPLOY.md) (A1-A6 deploy SOP、本 SOP の前提)
- [OPERATIONS.md](../OPERATIONS.md) (検証フェーズ全体 SSOT)
- [INVITE_ALLOWLIST_NOTES.md](../INVITE_ALLOWLIST_NOTES.md) (GCP Test users との同期)
- memory `Cursorvers default design` (canonical brand)

---

## 13. 着手判断

- [ ] **着手**: invite-only 検証フェーズで `*.vercel.app` を顧問先に見せたくない、または配布メール A/B 送信前に URL を canonical 化したい
- [ ] **延期**: 一旦 `*.vercel.app` で運用、配布検証 (~5/末) 完了後に再評価
- [ ] **skip**: custom domain は OAuth verification 申請時 (将来) にまとめて実施
