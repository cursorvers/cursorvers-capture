# Self-Host セットアップ手順書

> 対象: Cursorvers Capture の独立インスタンスを **自分の名前で運用する** 配布先パートナー (税理士法人など)。
>
> 完了後の状態: あなた専用の URL (例: `capture.your-firm.jp`) でアプリが動き、データ・認証・AI 課金すべてあなたのインフラ。**Cursorvers (Masa) は一切経路に介在しない**。

---

## 完了までの全体像

```
[1] Cloudflare アカウント (無料)        ─┐
[2] GCP プロジェクト + OAuth Client     ─┼─ Web UI でアカウント整備 (約 25 分)
[3] Gemini API key                      ─┘
        ↓
[4] このリポジトリを clone (要 collaborator 招待)
[5] Codex Gateway を deploy (Worker)    ─┐
[6] Capture PWA を deploy (Pages)       ─┼─ ターミナルで wrangler 実行 (約 20 分)
[7] カスタムドメイン (任意)              ─┘
        ↓
[8] 招待者リスト (INVITE_ALLOWLIST) を投入
[9] iPhone で動作確認
```

**所要時間**: 45-60 分 (技術者なら 30 分以内)
**コスト**: 月 ¥0 (200 active users まで全部無料圏内)
**必要スキル**: ターミナル / Git / コピペコマンド実行

---

## 前提条件 (環境)

| 項目 | バージョン | 取得方法 |
|---|---|---|
| Node.js | ≥ 20 | https://nodejs.org/ |
| pnpm | ≥ 10 | `npm install -g pnpm` |
| Git | 任意 | macOS / Linux 標準、Win は git-scm.com |
| Google アカウント | 任意 | 普段使いの個人 or 組織 Workspace アカウント |
| クレジットカード | 不要 | 無料枠だけで完結する設定をします |

---

## Step 1. Cloudflare アカウント

ホスティング (Pages) + AI Gateway 用ランタイム (Workers) のために使う。**全機能とも無料プランで足ります**。

1. [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) で sign-up
2. 任意でドメインを追加 (CF DNS に乗せる、後で `capture.your-firm.jp` を貼り付け予定)
3. 左サイドバーで **Workers & Pages** を開いて、初回プロンプトに従って Workers サブドメイン (例: `your-firm.workers.dev`) を確定
4. Account ID をメモ (右側に表示) — wrangler の認証で使う

---

## Step 2. GCP プロジェクト + OAuth Client

ユーザーが「Google でサインイン」する先のプロジェクト。**Cursorvers の GCP プロジェクトとは完全別物**。

### 2-1. 新規プロジェクト作成

1. [GCP Console](https://console.cloud.google.com) で sign-in
2. 右上「プロジェクトの選択」→ 「新しいプロジェクト」→ 名前: `your-firm-capture` 等
3. プロジェクト切替

### 2-2. OAuth consent screen 設定

`APIs & Services → OAuth consent screen` を開く:

1. **User type**: External (組織 Workspace ユーザーだけなら Internal、こだわらないなら External で OK)
2. **アプリ情報**:
   - App name: `Your Firm Capture` (任意。ユーザーの同意画面に表示される)
   - User support email: あなたのメール
   - Developer contact: あなたのメール
3. **Scopes** (「ADD OR REMOVE SCOPES」):
   - `https://www.googleapis.com/auth/drive.file` をチェック
   - `https://www.googleapis.com/auth/drive.metadata.readonly` をチェック
   - (両方とも非機密 = Google 審査不要)
4. **Test users**: テスト中はここに対象メアドを追加。本番化したら不要

### 2-3. OAuth Client ID 発行

`APIs & Services → Credentials → Create Credentials → OAuth Client ID`:

1. Application type: **Web application**
2. Name: `Capture Web Client` 等
3. **Authorized JavaScript origins** (後で本番 URL に書き換える):
   ```
   http://localhost:3000           (開発用、任意)
   https://<project-name>.pages.dev (CF Pages 標準 URL、Step 6 で確定)
   https://capture.your-firm.jp    (カスタムドメイン使うなら)
   ```
4. Authorized redirect URIs: **空でOK** (このアプリは popup flow のみ)
5. 「作成」 → **Client ID をコピーしてメモ**

### 2-4. Google Drive API を有効化

`APIs & Services → Library → "Drive API" を検索 → ENABLE`

### 2-5. Production publish (招待者 100 名超で必要)

`OAuth consent screen → PUBLISH APP` ボタン。非機密スコープのみなので Google 審査なしで即反映。
100 名以下なら Testing mode のままで OK (test users に追加するだけ)。

---

## Step 3. Gemini API key

AI 解析の中身。**Free tier で 1500 req/日**。

1. [Google AI Studio](https://aistudio.google.com/apikey) を開く (Google アカウント要)
2. 「Create API key」 → 既存 GCP プロジェクトを選んでも、別途新規でも OK
3. **API key をコピーしてメモ** (`AIza...` で始まる 40 文字)

---

## Step 4. リポジトリを clone

事前に Masa から `cursorvers/cursorvers-capture` および `cursorvers/cursorvers-codex-gateway` の **Collaborator 招待メール** を受領していること。

```bash
# 招待を承諾してから:
mkdir -p ~/dev && cd ~/dev

git clone git@github.com:cursorvers/cursorvers-capture.git
git clone git@github.com:cursorvers/cursorvers-codex-gateway.git

# 依存解決
cd cursorvers-capture && pnpm install && cd ..
cd cursorvers-codex-gateway && pnpm install && cd ..
```

ローカル動作確認は **Step 4-bis** に記載。スキップして Step 5 に進んで構いません。

### Step 4-bis. (任意) ローカルで動作確認

```bash
cd cursorvers-capture
cp .env.local.example .env.local
# .env.local を編集:
#   NEXT_PUBLIC_GOOGLE_CLIENT_ID=<Step 2-3 の Client ID>
#   COOKIE_SECRET=$(openssl rand -hex 32)
#   INVITE_ALLOWLIST=your-email@example.com
#   CODEX_GATEWAY_URL=http://localhost:8787
#   CODEX_GATEWAY_KEY=local-dev-secret

# 別ターミナルで Gateway 起動:
cd ../cursorvers-codex-gateway
GATEWAY_AUTH_KEYS=local-dev-secret GEMINI_API_KEY=<Step 3 の key> pnpm dev

# Capture を dev で起動:
cd ../cursorvers-capture
pnpm dev
# → http://localhost:3000
```

---

## Step 5. Codex Gateway (CF Worker) をデプロイ

```bash
cd ~/dev/cursorvers-codex-gateway

# 5-1. wrangler に sign-in (初回のみ)
pnpm dlx wrangler login

# 5-2. wrangler.toml の name を自分用に書き換え (任意)
# 例: name = "your-firm-codex-gateway"
# (省略可、デフォルトの cursorvers-codex-gateway のままでも動作する)

# 5-3. Bearer secret を生成 (2 つの値で 1 つは Capture 側で使う)
GATEWAY_SECRET=$(openssl rand -hex 32)
echo "Gateway secret (capture 側で再利用する): $GATEWAY_SECRET"
echo "$GATEWAY_SECRET" > /tmp/gateway-secret.txt   # 一時保管、step 6 で使ったら消す

# 5-4. シークレット投入
printf '%s' "$GATEWAY_SECRET"  | pnpm dlx wrangler secret put GATEWAY_AUTH_KEYS
printf '%s' "<Step 3 の Gemini key>" | pnpm dlx wrangler secret put GEMINI_API_KEY

# 5-5. ビルド + デプロイ
pnpm build:worker
pnpm dlx wrangler deploy

# → 出力例: https://your-firm-codex-gateway.<your-cf-account>.workers.dev
# この URL をメモ
```

---

## Step 6. Capture PWA (CF Pages) をデプロイ

```bash
cd ~/dev/cursorvers-capture

# 6-1. プロジェクト作成
pnpm dlx wrangler pages project create your-firm-capture --production-branch=main
# → 出力例: https://your-firm-capture.pages.dev (= pages.dev URL)

# 6-2. シークレット投入
COOKIE_SECRET=$(openssl rand -hex 32)
GATEWAY_SECRET=$(cat /tmp/gateway-secret.txt)   # Step 5 で保存した値
GATEWAY_URL="https://your-firm-codex-gateway.<your-cf-account>.workers.dev"   # Step 5 で出た URL
ALLOWLIST="your-email@example.com,client-a@example.com,client-b@example.com"

printf '%s' "$COOKIE_SECRET"    | pnpm dlx wrangler pages secret put COOKIE_SECRET    --project-name=your-firm-capture
printf '%s' "$ALLOWLIST"        | pnpm dlx wrangler pages secret put INVITE_ALLOWLIST --project-name=your-firm-capture
printf '%s' "$GATEWAY_URL"      | pnpm dlx wrangler pages secret put CODEX_GATEWAY_URL --project-name=your-firm-capture
printf '%s' "$GATEWAY_SECRET"   | pnpm dlx wrangler pages secret put CODEX_GATEWAY_KEY --project-name=your-firm-capture

# 6-3. NEXT_PUBLIC_GOOGLE_CLIENT_ID を wrangler.toml の [vars] に直書きするか、
#       .env.production を作る (ビルド時に焼き込まれる)
# 簡単なのは wrangler.toml を編集:
#   [vars]
#   NEXT_PUBLIC_GOOGLE_CLIENT_ID = "<Step 2-3 の Client ID>"

# 6-4. ビルド + デプロイ
pnpm build
pnpm dlx wrangler pages deploy out --project-name=your-firm-capture --branch=main

# 一時ファイル消去
rm /tmp/gateway-secret.txt
```

デプロイ完了後の URL は `https://your-firm-capture.pages.dev`。

---

## Step 7. カスタムドメイン (任意)

CF DNS に乗っているドメイン (例: `your-firm.jp`) を使う場合:

1. CF Dashboard → Workers & Pages → `your-firm-capture` → **Custom domains → Add custom domain**
2. `capture.your-firm.jp` を入力
3. CF が DNS に CNAME を自動追加 (proxy ON)
4. SSL 証明書も自動発行 (1-5 分)
5. **重要**: Step 2-3 で設定した GCP OAuth Authorized JavaScript origins に `https://capture.your-firm.jp` を追加 (まだなら)

---

## Step 8. 招待者の追加・更新

```bash
# 既存リストを上書きする運用 (差分追加ではないので注意):
NEW_LIST="you@firm.jp,client-a@example.com,client-b@example.com,client-c@example.com"
echo "$NEW_LIST" | pnpm dlx wrangler pages secret put INVITE_ALLOWLIST --project-name=your-firm-capture
# secret 更新は即時反映、redeploy 不要
```

50 名超で動的管理 (UI からの追加・削除) が必要になったら、Phase 12 (KV / D1 化) を検討。

---

## Step 9. iPhone での動作確認

1. Safari で `https://capture.your-firm.jp` (または `*.pages.dev`) を開く
2. 「Google でサインイン」をタップ → ポップアップ → アカウント選択
3. **同意画面**:
   - 「**Your Firm Capture が次のことを希望しています**」と Step 2-2 で設定した名前が出る
   - スコープ: Drive のファイルと情報の閲覧 / 編集
   - 「許可」
4. ホームに戻る → 設定で 📄 領収書 などの サブフォルダを作成
5. 撮影 → AI が領収書として判別 → 領収書フォルダへ自動移動 + AI 解析結果表示
6. 「ホーム画面に追加」(共有メニュー) → PWA インストール

---

## トラブルシューティング

### 「invalid_scope」エラーが consent 時に出る

- GCP OAuth consent screen の「Scopes」セクションに 2 つの scope が追加されているか確認
- `drive.file` だけ追加して `drive.metadata.readonly` を忘れているケースが多い

### 「未確認のアプリ」黄色バナーが出る

- consent screen が **Testing** モードだとテストユーザー以外には警告が出る
- Production に移行するか、test users に追加する

### `/api/codex/analyze` が 502 を返す

- Worker のシークレット (`GATEWAY_AUTH_KEYS` / `GEMINI_API_KEY`) が正しく投入されているか確認
- `wrangler tail` で Worker のログを実時確認

```bash
cd ~/dev/cursorvers-codex-gateway
pnpm dlx wrangler tail
```

### `/api/me` が 401 を返す

- Pages 側の `COOKIE_SECRET` が変更されると既存 cookie が無効化される → 一度サインアウト・サインイン

### Gemini からのレスポンスが空 / 安全フィルタで弾かれる

- Gemini Flash の safety filter が反応した可能性
- 撮影画像に人の顔・個人情報が大量に映ると弾かれることがある
- prompt 側で sensitivity 調整 (Gateway src/providers/gemini.ts の generationConfig)

---

## 運用チェックリスト

セットアップ完了後、以下が成立しているか確認:

- [ ] iPhone Safari で `https://capture.your-firm.jp` がサインインまで到達
- [ ] 自分の Google アカウントで撮影 → 自分の Drive に保存される
- [ ] AI 解析が動作 (`📄 領収書` 等の判別)
- [ ] フォルダ振り分けが動作 (`/settings` でフォルダ作成 → 撮影 → 自動移動)
- [ ] 履歴 (`/history`) で過去撮影が一覧できる
- [ ] フォルダ共有 (`設定 → 共有`) でリンク or メール招待が動く
- [ ] **Cursorvers (Masa) のドメイン / URL を経由していない** (Network タブで確認: `capture.cursorvers.jp` / `*.masa-stage1.workers.dev` への通信がない)

---

## 上記が成立した時点で

このインスタンスは **Cursorvers Capture の独立コピー** として機能しています。

- ユーザーデータ: 100% あなたのインフラ + ユーザー自身の Drive
- AI 課金: あなたの Gemini API key
- 認証: あなたの GCP OAuth Client
- 運用責任: あなた
- Cursorvers (Masa) との関係: **コード提供元 (= GitHub の collaborator) のみ**、データパスには一切いない

Masa が `capture.cursorvers.jp` を畳んでも、あなたのインスタンスは独立稼働を続けます。

---

## アップデート (将来コード更新を取り込む)

Masa が機能改善を push したら:

```bash
cd ~/dev/cursorvers-capture
git fetch origin
git merge origin/master   # or git pull --rebase
pnpm install              # 依存変化があれば
pnpm build
pnpm dlx wrangler pages deploy out --project-name=your-firm-capture --branch=main

cd ../cursorvers-codex-gateway
git fetch origin && git merge origin/master
pnpm install
pnpm build:worker
pnpm dlx wrangler deploy
```

破壊的変更 (環境変数追加など) があれば、リリースノート (`CHANGELOG.md` または GitHub Release) で案内します。

---

## サポート

- セットアップで詰まったら: GitHub Issues に書く (private repo 内、collaborator のみ閲覧可)
- セキュリティ事案: [info@cursorvers.com](mailto:info@cursorvers.com) (subject: SECURITY)
- 機能要望: GitHub Discussions (有効化されている場合)
