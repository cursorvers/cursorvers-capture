# Cursorvers Capture

> スマホで撮るだけで **Google Drive に整理される** 招待制 PWA。
> 領収書・メモ・名刺を AI が判別 → 自動フォルダ振り分け → 全文検索 → コメント共有。

🌐 **Live**: [https://capture.cursorvers.jp](https://capture.cursorvers.jp) (招待制)
📦 **Status**: production / v0.9 — マルチテナント運用可能
💴 **Cost**: ¥0/月 (Cloudflare 無料枠 + Gemini Flash 無料 tier)

---

## TL;DR

| 質問 | 答え |
|---|---|
| 何のためのアプリ? | 紙の領収書・メモ・名刺を**撮影 1 タップで Drive へ**送り、AI に分類・命名・要約してもらう |
| 誰のため? | 個人事業主 / 経営者 / 営業職 / それを支える税理士・会計士 |
| 普通の Drive アップローダとの違いは? | AI が中身を読んで「📄 領収書: スタバ ¥580 (2026-05-18)」と要約し、自動的にサブフォルダへ振り分ける |
| データはどこに? | **完全にユーザー自身の Google Drive のみ**。Cursorvers のサーバーは画像を保存しない |
| 自分のクライアントにも使わせられる? | **可能**。同じ URL で全員サインイン、各自の Drive に保存、Drive 共有で協業 |
| 月額いくらかかる? | **¥0 維持**。Gemini 無料 tier 内 (~150 active 名/日) |

---

## 目次

1. [できること](#できること)
2. [アーキテクチャ](#アーキテクチャ)
3. [マルチテナント設計 (税理士法人ユースケース)](#マルチテナント設計-税理士法人ユースケース)
4. [データ境界とプライバシー](#データ境界とプライバシー)
5. [技術スタック](#技術スタック)
6. [OAuth スコープと「できる/できない」](#oauth-スコープとできるできない)
7. [ローカル開発](#ローカル開発)
8. [デプロイ](#デプロイ)
9. [環境変数](#環境変数)
10. [GCP OAuth セットアップ](#gcp-oauth-セットアップ)
11. [AI Provider 切替](#ai-provider-切替)
12. [コスト構造](#コスト構造)
13. [運用 (招待・スケール)](#運用-招待スケール)
14. [ロードマップ](#ロードマップ)
15. [ライセンス](#ライセンス)

---

## できること

### 撮影フロー

```
[📷 撮影] → [Drive へ直接アップロード] → [Codex AI 解析]
                                            ↓
              [💬 cdx の一言コメント (タイプライター reveal)]
              [📄 領収書 / 📝 メモ / 💳 名刺 / 📷 その他]
              [🏬 店名] [💴 ¥金額] [🗓 日付]
              [📁 振り分け先サブフォルダ]
              [✏️ 提案ファイル名 → タップで Drive に適用]
```

- **撮影 → アップロード → AI 解析** が 1 タップで連続実行
- **AI が doc_type を判別**: 領収書 / メモ / 名刺 / その他
- **構造化抽出**: 領収書なら店名・金額・日付、メモなら見出し・箇条書き、名刺なら会社名・氏名
- **タイプライター reveal**: Codex の応答が 18ms/char で流れる (体感が "AI が考えている")
- **連続撮影 batch**: AI 待機なしで次々撮影、最新 5 件が panel として stack 表示
- **チップ訂正 UX**: 抽出値をタップして 1 操作で修正、Drive description + IDB 両方に persist

### 整理フロー

```
[/settings]
  └─ 「保存先振り分け」
       ├─ 📄 領収書    → 「📁 領収書 を作成」 タップで Drive サブフォルダ自動生成
       ├─ 📝 メモ      → 同上
       ├─ 💳 名刺      → 同上
       └─ 📷 その他    → 設定すれば振り分け、未設定なら main folder 残置
```

- **doc_type → サブフォルダ自動振り分け**: AI 判定後、即 `Drive PATCH addParents/removeParents` で物理的に移動
- **フォルダは drive.file scope で新規作成**: app が作ったフォルダは編集権限完全保持

### 履歴・検索

```
[/history]
  🔎 [検索バー: 店名・金額・日付・キーワード]
  [📄 領収書] [📝 メモ] [💳 名刺] [📷 その他]   [🔘 未解析 12]   [クリア]

  ┌── サムネ ── 「スタバの領収書、580円」 ──── 2分前 · 🏬 スタバ · 💴 ¥580 · 📁 領収書 ──┐
  ┌── サムネ ── 「明日の TODO 3 項目」  ──── 1時間前 · ✍️ TODO · 📁 メモ                  ─┐
  ...
```

- **IndexedDB 駆動**: 起動即時にローカルキャッシュから render、Drive 同期はバックグラウンド
- **検索**: vendor / 金額 / 日付 / コメント / ファイル名を横断、即時フィルタ
- **doc_type フィルタピル**: 複数選択可能
- **未解析バッジ**: app の AI を通っていない既存写真 (Drive iOS で入れた等) も表示、別途解析依頼可

### 共有・協業

```
[フォルダ共有 sheet]
  📁 領収書
  ┌─ リンクで共有 ─────────────── ON ┐
  │ [https://drive.google.com/...]      │
  │ [コピー] [📤 LINE / メール等で送る]  │
  └─────────────────────────────────┘
  ┌─ メールで招待 ──────────────────┐
  │ [name@example.com]                │
  │ [閲覧者 ▾] [招待]                 │
  └─────────────────────────────────┘
  ┌─ 共有中 (2) ─────────────────────┐
  │ accountant@example.com  閲覧者 [解除]│
  │ partner@example.com    コメント可 [解除]│
  └─────────────────────────────────┘
```

- **リンク共有**: anyone-with-link permission を 1 タップ ON/OFF
- **メール招待**: 特定アドレスに reader / commenter 権限
- **iOS Web Share API**: 「📤 LINE / メール等で送る」タップで iOS 標準シェアシート起動
- **Drive ネイティブコメント**: 写真ごとに `POST /files/{id}/comments` で書き込み、Drive Web / Drive アプリでも同じコメントが見える

---

## アーキテクチャ

```
                  ┌────────────────────────────┐
                  │      iPhone Safari (PWA)    │
                  │  capture.cursorvers.jp      │
                  └────────┬───────────────────┘
                           │ ┌──────────────────┐
                           ├─┤ Google Identity  │ サインイン (popup)
                           │ │ Services (GIS)   │ scope: drive.file + drive.metadata.readonly
                           │ └──────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌─────────────┐
       │ Static   │  │ Pages    │  │ Drive API   │
       │ Assets   │  │ Functions│  │ (direct from│
       │ (HTML/JS)│  │ /api/me  │  │  browser)   │
       └──────────┘  │ /api/    │  └─────┬───────┘
                     │ codex/   │        │
                     │ analyze  │        │
                     └────┬─────┘        │ files.create
                          │ Bearer       │ files.update
                          │ (shared      │ files.list
                          │  secret)     │ permissions.create
                          ▼              │ comments.create
                ┌────────────────────┐   │
                │ Codex Gateway      │   │
                │ (CF Worker, Hono)  │   │
                │ /v1/analyze        │   │
                │ /v1/ocr            │   │
                │ /v1/audio          │   │
                └────────┬───────────┘   │
                         │ Provider abstraction
                ┌────────┼────────┐      │
                ▼        ▼        ▼      ▼
            ┌──────┐ ┌──────┐ ┌────┐ ┌──────────────┐
            │Gemini│ │OpenAI│ │Cla.│ │ User's Drive │
            │ 2.5  │ │stub  │ │stub│ │ (per user)   │
            │Flash │ │      │ │    │ │              │
            └──────┘ └──────┘ └────┘ └──────────────┘
```

### 主要コンポーネント

| 層 | 役割 | 技術 |
|---|---|---|
| **PWA フロントエンド** | UI、IDB キャッシュ、Drive 直叩き、camera/audio capture | Next.js 14 (static export), Tailwind, IndexedDB |
| **Pages Functions** | cookie auth (`/api/me`), AI 呼び出しプロキシ (`/api/codex/analyze`), invite-gate middleware | Cloudflare Pages Functions (V8 isolate, Web Crypto) |
| **Codex Gateway** | AI provider 抽象化、Bearer 認証、レート制限、`/v1/analyze` `/v1/ocr` `/v1/audio` | Cloudflare Worker (Hono framework) |
| **AI Provider** | 画像 + 音声 → 構造化 JSON 出力 | Gemini 2.5 Flash via REST (OpenAI / Claude は stub、env で切替可) |
| **データ** | 画像本体 + AI 解析メタデータ + コメント | 各ユーザーの Google Drive (description / comments) + 各端末の IndexedDB |

### 2 レポジトリ構成

```
~/Dev/gdrive-uploader/             ← この repo: PWA フロントエンド
└─ next.config.mjs / app/ / functions/ / wrangler.toml

~/Dev/cursorvers-codex-gateway/    ← 別 repo: AI Gateway
└─ src/{app,worker,routes,providers}.ts / wrangler.toml
```

PWA と Gateway は完全独立、Bearer secret で通信。Gateway を別の URL に挿げ替えれば PWA は無修正で provider/host を変えられる。

---

## マルチテナント設計 (税理士法人ユースケース)

**実例**: 個人事業の領収書を整理 + 顧問税理士法人 + 同税理士法人の別クライアント (社長 X) — 3 者で共有運用したい場合。

### データフロー

```
            [https://capture.cursorvers.jp]    ← 同じ 1 つの URL
                       ▲
        ┌──────────────┼──────────────────┐
        │              │                  │
   サインイン       サインイン           サインイン
   (自分の          (税理士法人の        (社長 X の
    Google)         Google)             Google)
        │              │                  │
        ▼              ▼                  ▼
   ┌─────────┐   ┌──────────┐    ┌───────────────┐
   │自分の   │   │税理士の   │    │社長 X の       │
   │Drive    │   │Drive     │    │Drive          │
   │└領収書/  │   │└領収書/  │    │└領収書/        │
   │└メモ/    │   │└メモ/    │    │└メモ/          │
   └────┬────┘   └────▲─────┘    └───┬───────────┘
        │             │                │
        │ 「共有」     │ 「共有」        │
        │ ボタンで    │ で受領          │
        │ 税理士に    │ (Drive の       │
        │ 招待        │  共有アイテム)   │
        └─────────────┴────────────────┘
                      │
                      ▼
           税理士の Drive「共有アイテム」に
           各クライアントの フォルダが並ぶ
                      ↓
              税理士が経費精算へ
```

### 重要な性質

1. **アプリは 1 つだけ** (`capture.cursorvers.jp`)、全員が同じ URL を使う。デプロイは 1 系統で運用 1 件のみ。
2. **各ユーザーが自分の Drive を持つ**。個人事業主の領収書はその人の Drive、税理士のメモは税理士の Drive — 物理的に分離。
3. **Cursorvers サーバーは 1 バイトも画像を保存しない**:
   - 画像のアップロードは PWA から直接 Drive API へ送信
   - AI 解析時のみ Codex Gateway 経由で Gemini へ転送、レスポンス取得後即 GC
   - 解析結果も書き込み先はユーザーの Drive description のみ
4. **税理士が見るのは「共有された分だけ」**:
   - 個人事業主 A が「📁 領収書 → 共有 → tax@example.com」と設定 → 税理士の Drive に共有アイテムとして出現
   - 個人事業主 B が同様に共有 → 同じ税理士に集まる
   - A の領収書を B が見ることは原理的に不可能
5. **税理士本人もこの app を使える**:
   - 自分宛の領収書を自分で撮影 → 自分の Drive に保存
   - 顧問先からの共有フォルダはこの app の `/history` ではなく Drive アプリで参照 (drive.file scope は他人作成のフォルダ全体は見えないため。共有を受け取った個別ファイルは見える)

### 招待管理

`INVITE_ALLOWLIST` (環境変数) に対象者全員のメールアドレスを comma-separated で登録:

```
INVITE_ALLOWLIST=masa.stage1@gmail.com,tax-advisor@example.com,president-x@example.com
```

更新は `wrangler pages secret put INVITE_ALLOWLIST --project-name=cursorvers-capture` で即時反映。
50 名超の動的管理が必要になったら、Cloudflare KV / D1 への移行を検討。

---

## データ境界とプライバシー

| データ種別 | 保存場所 | 暗号化 | 寿命 |
|---|---|---|---|
| 撮影画像本体 | ユーザーの Google Drive のみ | Google 標準 | ユーザーが削除するまで |
| AI 解析結果 (要約・タグ・抽出データ) | ユーザーの Google Drive `description` フィールド | Google 標準 | ファイルと同じ |
| ユーザーコメント | ユーザーの Google Drive `comments` (native API) | Google 標準 | ファイルと同じ |
| 認証 cookie | ユーザーの iPhone Safari (HttpOnly, Secure, SameSite=Lax) | HMAC-SHA-256 署名 | 24 時間 |
| AI 解析の中間ペイロード (画像 base64) | Codex Gateway の Worker メモリ (≤ 30 秒) | TLS in transit | レスポンス返却で即破棄 |
| ローカルキャッシュ | iPhone の IndexedDB (`captures` store) | OS 標準 | ユーザーがデータ消去するまで |
| Cursorvers Capture アプリのサーバー上 | **何も保存しない** | — | — |

### Codex Gateway が見るデータ

- 画像 base64 (Gemini への中継)
- 音声 base64 (もしユーザーが録音した場合)
- ファイル ID, ファイル名 (任意)

Gateway はリクエスト処理中のみメモリに保持、ログにも記録しない (ログ出力にペイロードを含めない実装)。

### Cookie の中身

```
gdrive_email = <email>.<HMAC-SHA256(email, COOKIE_SECRET) を hex>
```

email 自体は読めるが、`COOKIE_SECRET` を知らないと偽造不可。Pages Functions 側でも middleware で毎リクエスト検証。

---

## 技術スタック

| 層 | 技術 | 選定理由 |
|---|---|---|
| Framework | Next.js 14.2 (App Router, **static export**) | サーバー不要、CDN だけで動く |
| Styling | Tailwind CSS 3 (custom ink/accent palette) | ユーティリティで mobile-first |
| Runtime | Cloudflare Workers (V8 isolate, edge) | 無料 100k req/日、コールドスタート < 1ms |
| Auth | Google Identity Services (popup `initTokenClient`) + HttpOnly signed cookie | drive.file scope、user gesture 同期 popup |
| Storage | Google Drive REST v3 (uploads / metadata / permissions / comments) | ユーザー自身が所有 |
| AI | Gemini 2.5 Flash (structured output via `responseSchema`) | 無料 tier 1500/日、画像 + 音声 multimodal |
| Local cache | IndexedDB v2 (`captures` store with 5 indexes) | ネイティブ、検索が即時 |
| PWA | manifest + service worker | ホーム画面追加、オフライン assets |
| 型 | TypeScript 5 (strict) + `@cloudflare/workers-types` | 型でガード |

---

## OAuth スコープと「できる/できない」

このアプリが要求する Google スコープ:

| Scope | 種別 | 用途 |
|---|---|---|
| `https://www.googleapis.com/auth/drive.file` | **非機密** | アプリが作ったファイル・フォルダの完全制御 (作成・読み・書き・共有・削除・コメント) |
| `https://www.googleapis.com/auth/drive.metadata.readonly` | **非機密** | 既存ファイル (Drive アプリで入れた領収書写真など) のメタデータと thumbnail を列挙 |

両方とも**非機密スコープ**のため Google の app verification 不要。

### 何ができる

- ✅ 撮影画像のアップロード
- ✅ AI 解析結果を description に保存
- ✅ ファイル名変更 (rename)
- ✅ サブフォルダの作成 (`領収書/` `メモ/` 等)
- ✅ 作成したフォルダ間でのファイル移動
- ✅ 作成したフォルダの共有 (link / email)
- ✅ ファイルへのコメント追加・閲覧・削除
- ✅ 既存ファイル (アプリ未経由) の **メタデータ列挙** (history に表示)
- ✅ 既存ファイルの thumbnail 表示

### 何ができない (現状)

- ❌ 既存ファイル (アプリ未経由) の **本体読み込み** → AI 解析できない
- ❌ アプリが作っていない既存フォルダの内容 list / 名前変更 / 削除
- ❌ ユーザーの Drive 全体の検索

### 解放するには

- **既存ファイルの解析**: Phase 9h で Drive Picker API を実装すれば、ユーザーが個別に「これを解析」と picker で選択 → そのファイルだけ drive.file 権限が付与される
- **Drive 全体走査**: `drive.readonly` (機密スコープ、verification 必要) を追加

---

## ローカル開発

### 必要なもの

- Node.js ≥ 20
- pnpm 10+
- Cloudflare アカウント (デプロイ時のみ)
- GCP プロジェクト + OAuth 2.0 client ID
- Gemini API key (Google AI Studio で発行)

### セットアップ

```bash
# 1. PWA フロントエンド
git clone <this-repo> gdrive-uploader
cd gdrive-uploader
pnpm install
cp .env.local.example .env.local
# .env.local を編集 (下記「環境変数」を参照)

# 2. Codex Gateway (別 repo)
git clone <gateway-repo> cursorvers-codex-gateway
cd cursorvers-codex-gateway
pnpm install
# Node.js 側でローカル実行:
GATEWAY_AUTH_KEYS=local-dev-secret GEMINI_API_KEY=AIza... pnpm dev
# → http://localhost:8787

# 3. PWA フロントエンドを dev で起動
cd ../gdrive-uploader
pnpm dev
# → http://localhost:3000
```

### コマンド

```bash
pnpm dev          # Next.js dev server (http://localhost:3000)
pnpm build        # 静的エクスポート → out/
pnpm test         # vitest (unit)
pnpm e2e          # playwright (e2e)
pnpm lint         # ESLint
```

---

## デプロイ

### PWA → Cloudflare Pages

```bash
# 1. プロジェクト作成 (初回のみ)
wrangler pages project create cursorvers-capture --production-branch=main

# 2. シークレット投入
printf '%s' "$COOKIE_SECRET"    | wrangler pages secret put COOKIE_SECRET    --project-name=cursorvers-capture
printf '%s' "$INVITE_ALLOWLIST" | wrangler pages secret put INVITE_ALLOWLIST --project-name=cursorvers-capture
printf '%s' "$CODEX_GATEWAY_URL"| wrangler pages secret put CODEX_GATEWAY_URL --project-name=cursorvers-capture
printf '%s' "$CODEX_GATEWAY_KEY"| wrangler pages secret put CODEX_GATEWAY_KEY --project-name=cursorvers-capture

# 3. ビルド + デプロイ
pnpm build
wrangler pages deploy out --project-name=cursorvers-capture --branch=main

# 4. カスタムドメイン (任意)
# Cloudflare Dashboard → Pages → cursorvers-capture → Custom domains → Add domain
# → DNS に CNAME (proxy ON) を追加
```

### Gateway → Cloudflare Worker

```bash
cd ../cursorvers-codex-gateway

# シークレット投入
printf '%s' "$GATEWAY_AUTH_KEYS" | wrangler secret put GATEWAY_AUTH_KEYS
printf '%s' "$GEMINI_API_KEY"    | wrangler secret put GEMINI_API_KEY
# (任意) printf '%s' "$OPENAI_API_KEY" | wrangler secret put OPENAI_API_KEY

# ビルド + デプロイ
pnpm build:worker
wrangler deploy
# → https://cursorvers-codex-gateway.<your-account>.workers.dev
```

---

## 環境変数

### PWA 側 (`.env.local` または CF Pages Secrets)

| 名前 | 説明 | 例 |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | GCP OAuth Web Client ID (公開) | `622805196021-xxx.apps.googleusercontent.com` |
| `COOKIE_SECRET` | HMAC-SHA-256 用 32-byte hex | `openssl rand -hex 32` で生成 |
| `INVITE_ALLOWLIST` | 招待 email を comma-separated | `a@example.com,b@example.com` |
| `PRO_USERS` | Pro tier email (任意) | `pro@example.com` |
| `CODEX_GATEWAY_URL` | Gateway の Worker URL | `https://cursorvers-codex-gateway.xxx.workers.dev` |
| `CODEX_GATEWAY_KEY` | Gateway 用 Bearer secret | `openssl rand -hex 32` で生成、Gateway 側 `GATEWAY_AUTH_KEYS` と一致 |

### Gateway 側 (Worker Secrets / `wrangler secret put`)

| 名前 | 説明 |
|---|---|
| `GATEWAY_AUTH_KEYS` | 受領を許可する Bearer secret の comma-separated 一覧 |
| `GEMINI_API_KEY` | Google AI Studio で発行 |
| `OPENAI_API_KEY` | 任意 (provider=openai で利用) |
| `ANTHROPIC_API_KEY` | 任意 (provider=claude で利用) |
| `CODEX_PROVIDER` | `gemini` (default) / `openai` / `claude`。`[vars]` セクションでも可 |

---

## GCP OAuth セットアップ

### 1. プロジェクト + Client ID 作成

1. [GCP Console](https://console.cloud.google.com) で新規プロジェクト作成 (例: `cursorvers-gdrive-uploader`)
2. **APIs & Services → OAuth consent screen**:
   - User Type: **External**
   - App name: `Cursorvers Capture`
   - User support email / Developer contact email を設定
   - Scopes に以下を追加:
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/drive.metadata.readonly`
3. **APIs & Services → Credentials → Create Credentials → OAuth Client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:3000` (開発)
     - `https://<your-deployment>.pages.dev`
     - `https://<your-domain>` (カスタムドメイン)
   - Authorized redirect URIs: (空でOK、popup flow なので使わない)
4. Client ID を `NEXT_PUBLIC_GOOGLE_CLIENT_ID` に設定

### 2. APIs を有効化

- **Google Drive API** を有効化 (APIs & Services → Library → "Drive API" → Enable)

### 3. Testing → Production

- Testing mode は最大 100 users
- **本番運用するには Publishing status を「In production」に変更**
- 非機密スコープのみなので Google verification 不要、即反映

---

## AI Provider 切替

Gateway 側で `CODEX_PROVIDER` 環境変数を切替可能 (PWA は無修正):

```bash
cd ../cursorvers-codex-gateway

# 例 1: Gemini 維持
# (デフォルト)

# 例 2: OpenAI に切替 (要 API key)
printf '%s' "sk-proj-xxxxx" | wrangler secret put OPENAI_API_KEY
# wrangler.toml の [vars] CODEX_PROVIDER を "openai" に書き換え + deploy
wrangler deploy

# 例 3: Anthropic Claude に切替
printf '%s' "sk-ant-xxxxx" | wrangler secret put ANTHROPIC_API_KEY
# CODEX_PROVIDER="claude" + deploy
```

> OpenAI / Claude provider は `src/providers/openai.ts` `src/providers/claude.ts` に stub 実装。本実装は契約 (`Provider` interface) に合わせて差し替えてください。

---

## コスト構造

### 標準構成 (Cloudflare + Gemini Free)

| 項目 | 月額 |
|---|---|
| Cloudflare Pages (Hosting) | ¥0 |
| Cloudflare Worker (Gateway) | ¥0 (100k req/日無料) |
| Cloudflare DNS / SSL | ¥0 (既存ドメインがあれば) |
| Gemini 2.5 Flash (1500 req/日 free tier) | ¥0 |
| Google Drive (ユーザー自身の quota) | ¥0 (15GB free per Google account) |
| **合計** | **¥0/月** |

### スケール時 (200+ active users)

| 項目 | 月額 |
|---|---|
| Cloudflare Workers Paid plan (10M req/月) | $5 |
| Gemini Flash Paid tier ($0.075 / 1M input tokens) | $5-10 (200 users × 20 req/日換算) |
| **合計** | **$10-15/月 (¥1,500-2,000)** |

> Drive 容量はユーザー側のもの。15GB 超で Google One 課金が発生するのもユーザー側。

---

## 運用 (招待・スケール)

### 招待を 1 名追加する

```bash
# 現状の allowlist を確認 (例: a@x.com,b@x.com)
# 新メアドを足して再投入
NEW="a@x.com,b@x.com,c@x.com"
echo "$NEW" | wrangler pages secret put INVITE_ALLOWLIST --project-name=cursorvers-capture
# 即時反映 (deploy 不要)
```

### Test User として登録 (OAuth が Testing mode の場合)

GCP Console → OAuth consent screen → Test users → +ADD USERS → メアド入力

### 50 名超の管理が必要になったら

- INVITE_ALLOWLIST 文字列が長くなりすぎる
- Cloudflare KV / D1 を導入してメアドリストを DB 化
- 設定画面に「招待管理」UI を追加 (将来の Phase 10 候補)

### 100 名超で OAuth Testing mode 上限

- Publishing status を **「本番環境」** に切替 (1 分作業、Google 審査不要)
- ただし、ユーザーは初回サインイン時に「未確認のアプリ」黄色バナーを見る可能性 (非機密スコープのみだとほぼ出ないが、Google の判定次第)

---

## ロードマップ

### Shipped

| Phase | 内容 |
|---|---|
| 0-5 | CF Pages 移行 (Vercel → Cloudflare) |
| 6 | Codex AI + History |
| 7 | Codex Gateway 独立 Worker 化 |
| 8 | 用途を医療 OCR → 領収書/メモ Secretary にピボット |
| 9a-b | doc_type 自動振り分け + IDB 駆動の検索 |
| 9c | 抽出値チップの inline 訂正 UX |
| 9d | 連続撮影 batch (5 件 stack) |
| 9e | フォルダ共有 (link / email, Web Share API) |
| 9f | Drive ネイティブコメント |
| 9g | 既存写真の可視化 (`drive.metadata.readonly`) |

### Next Up

- **Phase 9h: Drive Picker** — 既存写真を選んで AI 解析
- **Phase 10: オンボーディング** — 初回 3-step ガイド
- **Phase 11: CSV エクスポート** — 月次の領収書一覧を XLSX/CSV に
- **Phase 12: 招待管理 UI** — 設定画面から allowlist 編集 (KV/D1 化)

### Considered (v1.x)

- オフラインキュー (撮影だけして後で同期)
- Whitelabel テナント分離 (税理士パッケージ販売向け)
- 共有先テンプレ ("月初に顧問税理士に自動シェア" 等)
- 名刺 → 連絡先 (Google Contacts) 連携

---

## ライセンス

UNLICENSED (private). Cursorvers Inc. 内利用および招待制配布のみ。
オープンソース化検討中 — 興味があれば issue / discussion でご相談ください。

---

## 関連リポジトリ

- `cursorvers-codex-gateway` — AI provider 抽象化 Worker (別 repo)

## 連絡先

- 開発・運用: Cursorvers Inc. (大田原正幸)
- 配布: 招待制 — [info@cursorvers.com](mailto:info@cursorvers.com)
