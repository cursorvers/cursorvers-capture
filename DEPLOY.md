# gdrive-uploader — Deploy SOP

最終更新 2026-05-13 / FUGUE run `fugue-gdrive-uploader-2026-05-13` で pre-stage。

## 前提

- S1-S12 完納、HEAD `b699b77`
- build: 98.5 KB First Load JS / test: 46 passing + 8 e2e
- `.env.local` 雛形は生成済 (`.env.local` を開いて user 投入箇所を埋める)

## 残工程 (user 手動 3 step)

### Step 1. GCP OAuth Client ID 作成

1. https://console.cloud.google.com/ にログイン (flux@cursorvers.com 推奨)
2. **プロジェクト**: 既存 `cursorvers-gdrive-uploader` (or 任意名) を選択 or 新規作成
3. **APIs & Services → OAuth consent screen**:
   - User Type: **External** (Testing mode)
   - App name: `gdrive-uploader` (or 任意)
   - User support email: flux@cursorvers.com
   - Scopes: `.../auth/drive.file` を追加 (Sensitive 扱いだが drive.file は verification 不要)
   - Test users: 投入予定の advisor email を全て追加 (~100 件まで)
4. **Credentials → Create Credentials → OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://<your-vercel-domain>.vercel.app`
     - (将来 custom domain: `https://capture.cursorvers.com` 等)
   - Authorized redirect URIs: 同上 (GIS implicit flow なので redirect 厳密には不要だが推奨)
5. **Client ID** をコピー → `.env.local` の `NEXT_PUBLIC_GOOGLE_CLIENT_ID` に投入

### Step 2. INVITE_ALLOWLIST 投入

`INVITE_ALLOWLIST_NOTES.md` を参照。`.env.local` の `INVITE_ALLOWLIST` を comma-separated で埋める。

例:
```
INVITE_ALLOWLIST=kozai@example.org,hasegawa@example.org,admin@cursorvers.com
```

### Step 3. Vercel deploy

```bash
cd /Users/masayuki/Dev/gdrive-uploader

# 初回のみ
vercel link          # team/project を選択 (or 新規 create)

# 環境変数を Vercel に投入 (.env.local の中身を一括)
vercel env pull .env.production.local  # 既存 envs を確認
# 以下を Vercel Dashboard or CLI で投入:
#   NEXT_PUBLIC_GOOGLE_CLIENT_ID  (Production + Preview)
#   INVITE_ALLOWLIST              (Production + Preview, Server-only)
#   PRO_USERS                     (Production + Preview, Server-only) -- 任意
#   COOKIE_SECRET                 (Production + Preview, Server-only)
#   KV_ENCRYPTION_KEY             (Production + Preview, Server-only)
#   WEBHOOK_SECRET                (Production + Preview, Server-only)
# KV_REST_API_URL/TOKEN は Vercel KV integration を有効化すると自動注入
# Tier B endpoints は別 service (docs/codex-gateway-spec.md) 構築後に投入

# Production deploy
vercel --prod
```

### Step 4. (Optional) Vercel KV integration

Vercel Dashboard → Storage → Create Database → KV (Upstash) を選択 →
このプロジェクトに connect。KV_REST_API_URL / KV_REST_API_TOKEN が自動注入される。

KV を有効化しなくても、middleware と /api/me は in-memory で fall back する設計 (S12 polish)。

### Step 5. Smoke test

1. Vercel URL を開く → OAuth ログイン → カメラ起動 → 撮影 → Drive に upload 成功確認
2. `?folder=<your-folder-id>` で folder pre-fill 確認
3. INVITE_ALLOWLIST 外の email でログイン拒否確認

## トラブルシュート

| 症状 | 対処 |
|---|---|
| `redirect_uri_mismatch` | GCP Console の Authorized origins に Vercel URL を追加 |
| `access_denied` | OAuth consent screen の Test users に email を追加 |
| KV undefined errors | Vercel KV integration を connect、または local では KV 周り fallback path を確認 |
| INVITE_ALLOWLIST 効かない | Server-only env か確認、`NEXT_PUBLIC_` prefix なし、Vercel で Production scope に投入されているか |
| Tier B (OCR/audio) stub warning | 想定動作。Codex Gateway service 構築までは stub mode で OK |

## 配布

`DISTRIBUTION_EMAIL_DRAFT.md` の下書きを使って、ROSTER 上の advisor に link を送る。
