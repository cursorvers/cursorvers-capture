# Cursorvers Capture

スマートフォンでレシートを撮影し、**Google Drive** のフォルダへ保存する **PWA**（実験的・招待制）。旧称 Gdrive Uploader から UI を **Apple 風に簡素化**した構成です。

## デプロイ手順（Vercel）

1. リポジトリを Vercel に接続する。
2. **Build**: `pnpm build` / **Install**: `pnpm install`
3. 環境変数（Project Settings → Environment Variables）を設定する（後述）。
4. 本番 URL を GCP OAuth の「承認済みの JavaScript 生成元」に追加する。

## 招待リンクとフォルダ共有

- ベース URL: `https://<your-deployment>.vercel.app`
- 共有フォルダを固定する場合: `https://<your-deployment>.vercel.app/?folder=<DriveFolderId>`
- **INVITE_ALLOWLIST** に含まれないメールは `/not-invited` へ案内される。
- 許可リストの件数が **95 以上**で、かつメールがリスト外の場合は GCP 採算都合の **grace degradation** として `/full`（定員ページ）へルーティングする。

## GCP / OAuth（テスト・本番）

1. Google Cloud で **Google Drive API** を有効化する。
2. **OAuth クライアント ID**（ウェブアプリケーション）を作成する。
3. **承認済みの JavaScript 生成元**に `http://localhost:3000` と本番 URL を入れる。
4. **テストユーザー**を OAuth 同意画面に追加する（公開前は外部テスター扱いになる）。
5. スコープはアプリ実装に合わせ **`drive.file` 等の限定スコープ** を使う（方針は `/privacy` 参照）。

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` にクライアント ID を設定する。

## 主要な環境変数

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | GIS / Drive クライアント ID |
| `COOKIE_SECRET` | 署名 Cookie・KV 暗号化鍵導出のフォールバック（`openssl rand -hex 32`） |
| `KV_ENCRYPTION_KEY` | KV 永続値の **AES-256-GCM** 用（**推奨**: `openssl rand -hex 32`） |
| `INVITE_ALLOWLIST` | カンマ区切りメール。空ならゲート無効 |
| `PRO_USERS` | Tier `pro` のメール（カンマ区切り・trim） |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV（または互換 Redis） |
| `WEBHOOK_SECRET` | `/api/capture-webhook` の Bearer 検証 |
| `OPENAI_APPS_SDK_*` | Codex / AI 連携（未設定時は stub） |

詳細は `.env.local.example`。

## AI データフロー（Z3 要約）

1. **オプトイン**: 設定の「AI 補助」が ON のときだけ OCR・音声・チャットバック経路が有効。
2. **クライアント直結**: 画像バイナリは原則ブラウザから **Google Drive API** へ直接アップロード。
3. **一時処理**: 解析用テキスト・メタデータは当社指定バックエンドへ送られる場合があるが、方針として **長期保持しない（no retention）** とし、KV 上の状態は **暗号化 envelope（`kvenc:v1:`）** で保護する。

## Lighthouse（目安）

- **Performance**: First Load JS はルートで ~100kB 前後を目標（本番で再計測すること）。
- **Accessibility / Best Practices / SEO**: 主要ページで 90+ を狙う。実数値はデプロイ後に Chrome DevTools で取得。

## スクリプト

```bash
pnpm install
pnpm icons:gen   # app/icon.svg → PNG・アイコンファイル生成（sharp）
pnpm dev
pnpm build
pnpm test        # Vitest（46 件想定）
pnpm e2e         # Playwright
```

## ライセンス

リポジトリ内の `LICENSE` を参照。
