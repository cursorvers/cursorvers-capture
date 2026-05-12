# gdrive-uploader spec (v0 — Phase A locked candidate)

## 目的 (Goal)
スマホで撮影した写真を、指定した Google Drive フォルダへ「ユーザーが意識せずに」アップロードする PWA web app。ネイティブアプリ不要、Vercel 等の static + edge で完結。

## 競合調査結論 (verdict)
1. **Google Photos / Drive 公式アプリ**: バックアップは可能だが Drive 内の「特定フォルダ」へは直接振り分け不可。フォルダ強制が必須なら不適。
2. **PhotoSync / Autosync (MetaCtrl) / FolderSync**: ネイティブアプリ前提。「web app で完結」要件に反する。
3. **Uppy + Companion (self-host)**: 自作の Drive アップローダの **構成要素として有力**。ただし「Companion から Drive へ転送する」モデルなので、サーバー帯域を経由する=自前運用負荷あり。
4. **Filestack/Uploadcare/Cloudinary**: SaaS 月額 $89-$185+、Drive を **dest としては薄く**、自社CDN中継が前提でオーバースペック。
5. **Zapier/IFTTT/Make**: ネイティブ写真ロール watcher が前提 (IFTTT Android/iOS Photos)。撮影 → 即 Drive 反映には 5〜15 min ラグ、web app 要件に直接合わない。

→ **採用方針**: 自作 PWA (Next.js + Drive API 直叩き)。Uppy はオプション部品として後段で評価。

## 機能要件 (functional)
- F1. Google OAuth 2.0 でユーザー自身の Drive にサインイン (scope: `drive.file` 限定で OAuth verification を回避)
- F2. 設定画面で「保存先フォルダ ID」を選択・保存 (Drive Picker API or 手動 ID 入力)
- F3. 撮影: `<input type="file" accept="image/*" capture="environment">` をベース、必要なら `getUserMedia` プレビュー
- F4. 撮影直後に Drive resumable upload 開始 (foreground)
- F5. 失敗・オフライン時は IndexedDB キューに積み、再オープン時/オンライン復帰時に自動再送
- F6. Service Worker + Background Sync API (Android Chrome のみ動作、iOS は visible-tab fallback)
- F7. EXIF からの自動命名 (撮影日時 + デバイス名 hash)、フォルダ内に同名衝突なし
- F8. PWA: マニフェスト + アイコン + `display: standalone` + offline shell

## 非機能要件 (non-functional)
- N1. 価格: $0/月 (Vercel hobby + GCP free tier)
- N2. プライバシー: トークンは端末 `IndexedDB` のみ、サーバー保持なし
- N3. iOS Safari 16+ / Android Chrome 最新で動作。Background Sync 非対応端末は in-page retry で fallback
- N4. Drive API quota: 1 user 20,000 req / 100 s, 書込 ≤3 req/s sustained — 1 ユーザー個人利用では余裕
- N5. drive.file scope は OAuth verification 不要 (Google Workspace 公式)。100 ユーザーまでは Testing mode で OK

## アーキテクチャ (architecture)
- Frontend: Next.js 14 App Router + TypeScript + Tailwind, deploy on Vercel
- Auth: Google Identity Services (GIS) client lib → access_token を IndexedDB
- Upload: fetch + `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable` 直叩き
- Queue: IndexedDB (idb) + Service Worker + `registration.sync.register('upload-queue')`
- Server: 不要 (token は client only)。OAuth client_id は public、token は never server に渡らない

## スコープ外 (out of scope)
- 動画 (フェーズ2)
- 複数アカウント (フェーズ2)
- 共有 Drive (Shared Drive) (フェーズ2)
- 撮影前の編集 (crop/filter)
- 他クラウド (Dropbox, OneDrive)

## 自作 vs 既製品 採点 (60 点満点)

| 候補 | 初期コスト | 月額 | スマホweb | 自動UP | カスタム/プライバシ | 運用負荷 | 計 |
|---|---|---|---|---|---|---|---|
| Google Photos backup (ネイティブ) | 10 | 10 | 2 | 9 | 4 | 10 | **45** |
| PhotoSync (touchbyte) | 8 | 7 | 0 | 10 | 5 | 9 | **39** |
| Autosync MetaCtrl | 9 | 8 | 0 | 10 | 5 | 9 | **41** |
| Uppy + Companion self-host | 5 | 7 | 8 | 6 | 9 | 5 | **40** |
| Filestack / Uploadcare | 6 | 2 | 9 | 7 | 4 | 8 | **36** |
| Zapier/IFTTT/Make | 9 | 6 | 3 | 6 | 4 | 9 | **37** |
| **自作 PWA (本提案)** | 6 | 10 | 9 | 7 | 10 | 6 | **48** |

→ **verdict**: 自作 PWA が「指定フォルダ × プライバシー × $0/月」を同時に満たす唯一の候補。Google Photos backup は「スマホweb 要件」を欠く (2点)。**自作採用**。

## ロードマップ (slices)
- S1. skeleton: Next.js + Tailwind + manifest + Vercel deploy hook  → **+15% (累計 15%)**
- S2. OAuth flow: GIS + drive.file token persist + status UI → **+15% (30%)**
- S3. camera capture + preview + transient blob → **+10% (40%)**
- S4. Drive resumable upload happy path → **+20% (60%)** ← MVP demo
- S5. IndexedDB queue + retry-on-failure → **+10% (70%)**
- S6. Service Worker + Background Sync (Android only) + folder picker → **+10% (80%)**
- S7. EXIF naming + collision-safe + settings page → **+5% (85%)**
- S8. PWA polish (icons, install prompt, offline shell) + e2e test (playwright mobile) → **+10% (95%)**
- S9. GCP OAuth consent screen + privacy policy (user-side manual) → **+5% (100%)**

**今 = 0%、 MVP demo (S4) まで 4 slices、目的達成 (S8) まで 8 slices**。
S9 は GCP consent screen を user が操作する manual 工程のため、コード上は S8 完了で 95% を到達点とする。

## リスク
- R1. iOS Safari の Background Sync 不在 → 「visible tab 必須」を UX で明示するしかない
- R2. drive.file scope は app が作成した file のみ可視 → 既存フォルダへの書込は OK だが、再オープン時の listing は app 経由のみ
- R3. OAuth consent screen verification: drive.file なら通常不要だが、>100 ユーザーで sensitive scope 化する可能性 (Google 仕様変更リスク)
- R4. iOS Safari の Service Worker は app reload で停止 — queue は IndexedDB に必ず永続化、SW は一時的キャッシュ層に限定

## オープン質問 (Phase A → B amendment 許容)
- Q1. Drive Picker API を使う (verification 必要) or 手動 folder ID 入力 (verification 不要) — **defaults to 手動入力**
- Q2. EXIF 日時を JST に強制するか device-local か — **defaults to device-local**
- Q3. 撮影プレビュー UI を `getUserMedia` で作るか `<input capture>` だけにするか — **defaults to `<input capture>` (シンプル)**

---

## v1 amendments (Phase 1 multi-agent synthesis 2026-05-12)

3 critic 並列実行 (Codex plan-reviewer / GLM general-reviewer / Gemini general-reviewer) + Manus wide research。
共通発見を以下に統合。verdict: **CONDITIONAL_APPROVE with spec compression**。

### A1. MVP slice 数を 8 → 5 に圧縮
理由: GIS 暗黙的フロー = refresh token 取得不可、access token 1hr 期限。SW queue にタスクを貯めても期限切れで全 401。
よってオフラインキュー (旧 S5) と BG Sync (旧 S6) は **Phase 2** に延期。MVP は foreground 完結 + on-page retry に絞る。

新スライス計画:
- **S1**. scaffold: Next.js 14 App Router + TS + Tailwind + PWA manifest + Vercel deploy hook → **+20% (累計 20%)**
- **S2**. OAuth (GIS implicit, `drive.file` scope, token in IndexedDB with 1hr expiry, 401 → re-prompt) → **+20% (40%)**
- **S3**. camera capture + HEIC→JPEG 変換 (browser-image-compression) + EXIF orientation 補正 + 撮影日時抽出 → **+20% (60%)**
- **S4**. Drive resumable upload (2-4MB chunks) + Session URL を IndexedDB persist + on-page retry + ハッシュ付き unique filename → **+30% (90%)** ← MVP 完成
- **S5**. PWA polish (icons, install prompt, offline shell, manifest) + Playwright mobile e2e + Vercel prod deploy → **+10% (100%)**

### A2. Phase 2 backlog (本 spec 範囲外)
- B1. IndexedDB upload queue (token refresh フロー実装が前提)
- B2. Service Worker + Background Sync (Android Chrome のみ; iOS は visible-tab 維持)
- B3. Drive Picker API (OAuth verification 必要)
- B4. 複数アカウント / 共有 Drive
- B5. 動画 / 撮影前編集

### A3. 確定した実装制約 (LLM coding agent への hard contract)
1. **SW 登録**: `app/components/SWRegistry.tsx` を `'use client'`、`useEffect` 内で `navigator.serviceWorker.register('/sw.js')`。Server Component で触らない。
2. **Token 期限**: `expires_in` を IndexedDB に保存、API 401 を fetch wrapper でフックして `tokenClient.requestAccessToken({prompt: ''})` を呼ぶ。silent refresh 失敗時は modal で再認証。
3. **HEIC**: iOS で `capture` 経由のファイルが `image/heic` の場合、`browser-image-compression` で `image/jpeg` quality 0.85 に変換、EXIF orientation は `loadFromCanvas` で baked-in。
4. **Resumable upload**:
   - 初期化 POST → response の `Location` ヘッダを `IDBObjectStore: uploadSessions` に即書込
   - チャンク PUT (2MB, content-range)
   - ページリロード時は `uploadSessions` から resume URL 復元、`PUT Content-Range: bytes */<total>` で残量問合せ
5. **Filename uniqueness**: `drive.file` scope は existing file 検索不可。よって `<EXIF日時>-<sha1(blob).slice(0,8)>.jpg` で衝突を確率的に排除。
6. **iOS suspension**: アップロード中は `<meta name="viewport"...>` + `wake lock` (`navigator.wakeLock.request('screen')`) を `S4` で試み、unsupported は no-op。
7. **Chunk size**: iOS Safari 安定動作のため **2 MB chunk** 固定 (Drive 最小 256KB の倍数、4MB は cellular で不安定報告あり)。

### A4. 受入基準 (Definition of Done per slice)
- S1: `https://gdrive-uploader-<hash>.vercel.app/` が PWA install prompt を表示、Lighthouse PWA score ≥ 80
- S2: ログインボタンクリック → Google consent → token IDB 保存 → "Signed in as <email>" 表示
- S3: 「撮影」ボタン → カメラ → 1 枚撮影 → プレビュー (回転正常) → JPEG blob in memory
- S4: 撮影後自動で resumable upload 開始 → Drive 指定フォルダに `<JST 日時>-<hash>.jpg` 生成 → UI に "✅ 1 件アップロード済"。途中 reload → 自動 resume → 完了
- S5: Playwright で iPhone 14 Pro emul + Pixel 7 emul の 2 端末 e2e green、Vercel prod URL 公開

### A5. 達成度サマリ
- **現在 = 15%** (P0 verdict + P1 critique synthesis 完了、Phase A spec lock)
- **MVP 完成 (S4 完了) = 90%、残 4 slices**
- **目的達成 (S5 完了) = 100%、残 5 slices**
- 想定スループット: 1 slice 25-40 分 × 5 = **3-3.5 時間で MVP**、Vercel 上で操作可能

---

## v1.1 amendments (2026-05-12 — 堅牢・軽量・シェア対応)

### A6. シェア対応 (multi-user, zero-friction)
- **S0a. アカウント設計**: バックエンドなし、各 visitor が自分の Google アカウントで OAuth、トークン・設定は **その端末の IndexedDB のみ**。同じ URL で複数人が並行利用、相互非干渉。
- **S0b. フォルダ共有 link**: URL クエリ `?folder=<driveFolderId>` で起動時にフォルダ ID を pre-fill。オーナーが Drive folder を「編集権限」で共有 → 招待者がその link で開けば、招待者の OAuth で **オーナーの folder に書込** 可能 (`drive.file` scope は共有 folder 内 file の write を許可)。
- **S0c. デバイス識別子**: ファイル名衝突回避用に初回起動時 `crypto.randomUUID()` を localStorage に保存、命名規約に組み込む (`<JST>-<deviceId8>-<sha1_8>.jpg`)。
- **S0d. プライバシー注記**: README + 設定画面に「サーバー不経由、トークンは端末のみ」明示。
- **S0e. install 不要**: 同一 web URL を共有するだけで使える。PWA install は任意。

### A7. 堅牢性 (robustness hardening)
- **R1. fetch wrapper**: 401 → silent token refresh、5xx → exponential backoff (3 retry, jitter)、network error → IndexedDB queue (`pendingUploads`)。
- **R2. integrity check**: blob sha256 を upload 前後で verify、Drive API `md5Checksum` field と照合 (sha1 8 桁は filename 用、検証用 hash と分離)。
- **R3. concurrent upload cap**: 同時 2 並列まで (Promise queue 内製、`p-limit` 等不使用)。Drive write quota 3 req/s 遵守。
- **R4. resumable session TTL**: Drive resumable session は 7 日で expire。session URL に `createdAt` を併存、6 日経過で破棄→再 init。
- **R5. blob memory leak 防止**: `URL.createObjectURL` 後は必ず `revokeObjectURL`。撮影 blob は upload 完了/失敗確定後に即解放。
- **R6. CSP**: `next.config.mjs` の `headers()` で `default-src 'self'; connect-src 'self' https://*.googleapis.com https://accounts.google.com; img-src 'self' blob: data:; script-src 'self' https://accounts.google.com`。
- **R7. error boundary**: `app/error.tsx` + `app/global-error.tsx` で例外捕捉、reload ボタン表示。外部送信なし (依存追加禁止)。
- **R8. e2e 必須シナリオ** (S5):
  - 撮影 → upload → Drive API で folder 内出現を verify
  - upload 中に `navigator.onLine=false` 模倣 → resume URL persist → reconnect で完了
  - access token expire → 401 → silent refresh → resume
  - 同名連続撮影 2 枚 → hash 違いで 2 ファイル生成

### A8. 軽量化 (lightweight bundle)
- **L1. 依存追加は厳格制限**。S3 で `browser-image-compression` 1 件のみ追加可。EXIF は exifr 等不使用、Canvas natural rotation + HEIC→JPEG で焼込。
- **L2. Next.js static export 推奨**: 全ページ client-only のため `output: 'export'` を試行。失敗時は `output: 'standalone'` fallback。
- **L3. Lighthouse 目標**: Performance ≥ 90 / PWA ≥ 90 / a11y ≥ 90 (mobile profile)。bundle JS gzip ≤ **120 KB** target、≤ **180 KB** hard limit。
- **L4. tree-shaking 友好**: `lodash` `moment` `axios` 禁止。fetch / `Date` / 自家製 util。
- **L5. PWA icon**: SVG → PNG エクスポート 192/512 のみ。
- **L6. font**: `next/font/local` Geist (~50KB×4 woff2) **削除**、Tailwind の system font stack に統一。

### A9. スライス計画 v1.1 (堅牢・軽量・シェア組込)
| Slice | 内容 v1.1 で追加項目 | 増分 | 累計 |
|---|---|---|---|
| S1 | scaffold + PWA shell + CSP headers (R6) + manifest + Tailwind system font (L6) | +20% | 35% |
| S2 | OAuth (GIS, drive.file, 401 refresh R1) + URL `?folder=` parse (S0b) + deviceId (S0c) | +20% | 55% |
| S3 | camera + HEIC→JPEG (L1) + EXIF orientation + blob revoke (R5) + error boundary (R7) | +20% | 75% |
| S4 | Resumable upload (R3 concurrent cap, R4 TTL, R2 integrity, sha1-8 filename) + on-page retry | +30% | 90% |
| S5 | Lighthouse ≥90 (L3) + Playwright e2e (R8 4 シナリオ) + Vercel prod deploy + share link doc + bundle ≤180KB hard | +10% | 100% |

### A10. 受入基準 v1.1 補強
- S1: Lighthouse PWA ≥ 80、bundle JS gzip ≤ **60 KB** (scaffold 段階)
- S2: `?folder=xxx` query で folder pre-fill、token refresh hook が 401 path で発火
- S3: HEIC → JPEG 自動変換、EXIF orientation 焼込済、blob revoke が finally で 100% 実行
- S4: 2 並列上限、SHA1 8 文字 filename、reload で resume 完了、md5 verify pass
- S5: 4 e2e シナリオ green、bundle ≤ **180 KB** gzip、share link で別端末から同フォルダに upload 成功、Vercel prod URL 公開

---

## v2.0 α-pivot (2026-05-13 — Cursorvers advisory bundle 化)

### B0. 目的の再定義
- **旧目的**: 汎用「スマホ写真 → 指定 Drive」PWA
- **新目的**: **Cursorvers ブランドの advisory 顧問先専用「軽量・堅牢な receipt 共有 PWA」**
- 用途: 雑所得分等の小規模レシートを税理士の共有 Drive folder に毎日送る
- 配布: 限定公開 (Cursorvers 顧問先 + 招待 whitelist、~100 人、GCP Testing mode、OAuth verification 不要)
- ブランド: Cursorvers ロゴ + LP + privacy + 利用規約、独自ドメイン仮 `receipt.cursorvers.com`
- 戦略: 「商品」ではなく **advisory bundle 付加価値 + 技術ショーケース**。memory v3.4 凍結ルール (Q4 まで新 SKU NG) と整合。アップセル機能 (ii)+(iii) 解釈: 当面無料、課金 trigger は env 変数 OFF

### B1. 達成度 re-baseline
- 旧 100% (汎用 uploader) = **新目的 60%** (基盤 reuse 可、receipt 特化 + branding 未実装)
- 残 40% を 6 slices

### B2. 追加機能 (v2)
- **F9 (free)**: 月別フォルダ `YYYY-MM/` 自動生成
- **F10 (pro)**: OCR (Gemini API proxy or Tesseract.js、user toggle) で 日付・金額・店舗抽出 → ファイル名 `YYYY-MM-DD_<店舗>_<金額>.jpg`
- **F11 (pro)**: 月末 CSV (日付・店舗・金額・URL) Drive 書出 + 税理士共有 link
- **F12 (pro)**: 撮影回数カウンタ + free tier 50 件/月 gating (UI のみ、Q4 で activate)
- **F13**: Cursorvers branding (header logo, LP, footer privacy/terms)
- **F14**: 招待 whitelist (`NEXT_PUBLIC_INVITE_ALLOWLIST` env 内の Google アカウントのみログイン可)

### B3. 非機能 v2
- **N6**: bundle JS gzip ≤ **140 KB** (180→140 tighten)、Lighthouse Performance ≥ 95
- **N7**: client-only 継続。OCR の Gemini call のみ Vercel Edge Function proxy (key server-only)
- **N8**: privacy: 画像/抽出データは Cursorvers 側に永続保存しない。Edge Function stateless、ログも content 残さない
- **N9**: tier flag = `localStorage:pro_tier` + Drive config sync、admin 環境変数で手動付与、Stripe stub のみ

### B4. アップセル設計
- **Free**: 撮影 → Drive 直送、月別フォルダ、ファイル名 `<日付>-<sha1>.jpg`、月 50 件 cap
- **Pro (advisory bundle)**: OCR、smart filename、月末 CSV、共有 link、無制限
- 切替は admin 手動 (env `NEXT_PUBLIC_PRO_USERS=email1,...`)、`useTier()` hook で UI gate、Stripe webhook は stub

### B5. スライス計画 v2 (Phase B)
| Slice | 内容 | 増分 | 累計 | 委譲 |
|---|---|---|---|---|
| S6 | Cursorvers branding + tier flag system + privacy/terms placeholder | +5% | 65% | gemini-flash |
| S7 | Receipt free: 月別フォルダ + 招待 whitelist + JP UI | +10% | 75% | gemini-flash |
| S8 | OCR pro: Gemini Edge Function proxy + Tesseract.js fallback + user toggle | +15% | 90% | gemini-flash (核心) |
| S9 | 月末 CSV + 税理士共有 link + 50 件 counter | +5% | 95% | gemini-flash |
| S10 | bundle ≤140 KB + Lighthouse ≥95 + a11y + 追加 e2e | +3% | 98% | gemini-flash + audit |
| S11 | LP コピー仕上 + Privacy/Terms 本文 + ドメイン設定書 | +2% | 100% | gemini-flash |

### B6. リスク v2
- R9. Gemini API key 漏洩 → Edge Function proxy 必須
- R10. whitelist 硬すぎる UX → friendly reject + 問合せ link
- R11. ブランド付き = 信頼性必須 → e2e + Lighthouse 厳守
- R12. Q4 まで無料配布 → Stripe コード残骸が誤発火しないよう env で完全 OFF

### B7. v2.1 amendments (Gemini critique 2026-05-13)
Critical fixes applied to v2.0 before implementation starts:

- **F14 fix**: 招待 whitelist は **`INVITE_ALLOWLIST` server-only env** (NEXT_PUBLIC_ prefix 禁止) + **Edge Middleware** (`middleware.ts`) で route 保護。`NEXT_PUBLIC_*` だと client bundle に焼かれ全招待者メアドが PII 漏洩する (Gemini #1)。
- **F9 fix**: 月別フォルダ作成は **IndexedDB 排他ロック** + Drive API `files.list q="name='YYYY-MM' and trashed=false and mimeType='application/vnd.google-apps.folder'"` で existence check → 重複作成 race condition 防止 (Gemini #2)
- **F10 fix**: **Tesseract.js を削除** (2MB worker は 140 KB hard limit に違反)。OCR は **Gemini API 専用**、失敗時 fallback は **「手動入力 form」 (JS bundle 増加ゼロ)** (Gemini #3 + alternative)
- **N7 revision**: **Vercel Edge Function を Vercel API Route (Node.js runtime) に変更**。Edge は 4.5 MB payload limit、レシート画像 (8 MB target) が超える可能性。Node.js API Route は 4.5 MB request body limit だが、画像を再圧縮 (max 2 MB) してから送信で吸収。Gemini への送信は **base64 inline** (Drive URL 渡しは権限エラー、API key で読めない) (Gemini #3 + #4 fix)
- **F11 fix**: 月末 CSV を **upload 時に都度 append** に変更 (月末一括は Drive `files.list` 大量呼び出しで quota 圧迫)。`receipts-YYYY-MM.csv` を 1 行ずつ Drive resumable PATCH で末尾追加 (Gemini #5)

### B8. スライス計画 v2.1 (v2.0 から差分)
- S7 増分: 月別フォルダ race-safe 実装込
- S8 簡素化: Tesseract 削除で軽量化、Gemini OCR + 手動入力 form のみ
- S8 移行先: Edge Function → API Route (Node.js)、payload 2MB 再圧縮ロジック追加
- S9 増分: CSV を append 設計に
- 累計 % 配分は v2.0 維持 (S6+5, S7+10, S8+15, S9+5, S10+3, S11+2 = +40%)

---

## v4.1 canonical (2026-05-13 — 多エージェント 3 round 監査昇華版)

### Z0. canonical 宣言
本セクション以降が **唯一の有効仕様** (v1.1/v2.1/v3.0/v4.0 は historical archive、参考のみ)。
3 agent 監査 (GLM strategy + Gemini blind-spot + GLM math-reasoning) で確定。

### Z1. 目的の再定義 (最終)
- **「Cursorvers Capture — 撮影 → Google Drive 汎用アップローダー、Codex App Server で会話的 AI 統合、Cursorvers Advisory ポータルとしての副次機能を持つ」**
- 用途は user 任意 (税務・家族・業務・なんでも)
- 配布: Cursorvers 顧問先 + パートナー税理士法人、限定公開 ~100 users、GCP Testing mode

### Z2. アーキテクチャ: ハイブリッド設計 (★最重要 fix)

```
[iPhone Safari / Android Chrome / installed PWA]
         ↓
  Tier A: PWA 同期本体 (S1-S6 流用、5-sec 約束を達成)
    撮影 → blob → Drive resumable upload (drive.file)
    Drive 書込完了 → POST /api/capture-webhook (Vercel API Route)
         ↓
  Tier B: Codex App Server 非同期層 (新規 S7+)
    /api/capture-webhook → Codex App Server (Apps SDK)
    Chatback 生成 (撮影内容理解、metadata 整形、コメント) 
         ↓
    Push 通知 or 次回起動時表示 (PWA + ChatGPT App 両対応)
         ↓
  ChatGPT App セカンダリ (S11): 振り返り集計 / 任意共有 / Q&A / Advisory 連携
```

**根拠**: 3 agent 一致で「3-tap/5-sec は ChatGPT Apps SDK 環境で物理的に困難」と判定 → Tier A を PWA で同期完結させ、Codex は非同期付加価値層に分離。S1-S6 投資全活用、SDK ロックイン回避。

### Z3. データ責任分界 (法的 fix)
- **Cursorvers = パススルー型データプロセッサ**、データコントローラはユーザー
- 撮影画像は **Cursorvers サーバーを通過しない** (client → Drive 直送、現 S1-S6 実装)
- Codex App Server への送信は **metadata 抽出時のみ** (画像本体は base64 でも 1 回送信、即破棄、永続化なし)
- Privacy/Terms に明記:
  - prohibited use cases (違法、CSAM、機密漏洩、第三者著作権侵害)
  - Cursorvers モデレーション義務免責
  - データ削除権 (ユーザーが Drive 側で削除すれば Cursorvers 側にコピーなし)

### Z4. 確定機能 (Z1-Z3 を満たす実装範囲)
- **F1. 撮影 → Drive resumable upload** (S4 完納) — Tier A
- **F2. OAuth (drive.file scope)** (S2 完納) — Tier A
- **F3. PWA shell (mobile-first, install 任意)** (S1+S5 完納) — Tier A
- **F4. Cursorvers branding** (S6 完納)
- **F5. tier flag system (招待 whitelist + Pro env)** (S6 完納)
- **F6. Codex App Server Chatback (非同期)** — Tier B (S7)
- **F7. 任意共有 (Drive Permission API、招待 link で advisor pre-fill 可)** (S8)
- **F8. OCR optional (汎用 text 抽出、confidence ≥90% skip / <90% mandatory inline edit)** (S9)
- **F9. 音声メモ optional (PWA MediaRecorder → Codex App Server)** (S10)
- **F10. ChatGPT App セカンダリ画面 (振り返り集計 + Cursorvers Advisory Q&A)** (S11)

### Z5. 非機能 (最終)
- **N1. bundle JS gzip ≤ 140 KB hard** (現 93.9 KB)
- **N2. PWA Lighthouse ≥ 90 / Performance ≥ 95**
- **N3. Vercel KV 暗号化 AES-256-GCM**、鍵 rotation 月次、user 解約時 token 即破棄
- **N4. GCP 100 名上限到達時 Graceful Degradation** (新規登録停止 + Cursorvers 問合せ案内)
- **N5. SPOF mitigation**: ChatGPT 障害時 Tier A (PWA) は単独動作可、Chatback は次回起動時 retry

### Z6. 価格 scope 明確化 (GLM math-reasoning 指摘 fix)
- **「user 視点 = 完全無料」** (Cursorvers 顧問先・パートナー税理士法人の顧客は ¥0 で利用)
- **「Cursorvers 視点 = 経費 ≦ ¥3,000/月」** (Vercel hosting + Drive API はほぼ ¥0、Codex App Server は各 user の ChatGPT subscription が負担、わずかな KV 利用料のみ)
- Phase B (Q4 以降) で有料化検討、その際は新 SKU 化 → memory v3.4 凍結ルール期限切れと整合

### Z7. 差別化軸の継続的拡張 commitment (Gemini 「短期陳腐化」指摘 fix)
- **Phase A (今〜Q4)**: Codex Chatback + Cursorvers Advisory 連携 stub
- **Phase B (Q4〜)**: Cursorvers advisor 連携 GA (顧問先限定 Q&A、advisor 返信 inline)
- **Phase C (2027〜)**: 業種別 OCR pack (オプション、white-label 税理士法人向け)
- **Phase D**: Vault (FUGUE Knowledge Engine) 統合、過去全アップロードを横断検索
- 鍵: Cursorvers ブランドの **人間 advisor 接続性** が iOS/Drive ネイティブ AI に対する long-term moat

### Z8. canonical スライス計画
| Slice | 内容 | 増分 | 累計 | 委譲 |
|---|---|---|---|---|
| S1-S6 | scaffold/OAuth/camera/upload/polish/branding+tier | — | 65% | 完納 |
| **S7** | **Drive write 完了 → /api/capture-webhook → Codex App Server 非同期 Chatback (Apps SDK manifest + Codex SDK 統合 + IDB に最新 Chatback 履歴)** | +10% | 75% | gemini-flash |
| S8 | 任意共有 (Drive Permission API + プレビュー UI + Undo + 招待 link advisor pre-fill) | +5% | 80% | gemini-flash |
| S9 | optional OCR (Codex/Gemini multimodal、confidence flow、汎用 text 抽出) | +5% | 85% | gemini-flash |
| S10 | optional 音声メモ (PWA MediaRecorder → Codex App Server 整形 → metadata 焼込) | +5% | 90% | gemini-flash |
| S11 | ChatGPT App セカンダリ画面 (Apps SDK で振り返り集計 + Cursorvers Advisory Q&A stub) | +5% | 95% | gemini-flash |
| S12 | LP 汎用化 + Privacy (パススルー型) + Terms (prohibited list) + GCP Grace Deg + Vercel KV AES-256 + Advisory 連携 stub + Vercel prod deploy 手順 | +5% | 100% | gemini-flash |

### Z9. 現状達成度
- **65% (S1-S6 完納)、残 6 slices で 100%**
- 想定スループット: 1 slice 25-40 分 × 6 = **2.5-4 時間で 100%**

### Z10. 監査確認済リスクと対処
- ✅ 3-tap/5-sec 物理的不可能 → ハイブリッド設計で Tier A 同期
- ✅ v1-v3 累積矛盾 → v4.1 canonical 宣言、過去版 archive
- ✅ 違法コンテンツ免責 → Z3 で明記
- ✅ GCP 100 上限 → N4 Graceful Degradation
- ✅ Vercel KV 暗号化 → N3 AES-256-GCM + rotation + revoke
- ✅ 「完全無料」と「経費 ¥0」scope 不分離 → Z6 で明示分離
- ✅ Codex Chatback 短期陳腐化 → Z7 Cursorvers Advisory 連携を long-term moat
- ✅ 戦略 ROI 「単なる便利ツール」 → Cursorvers Advisory ポータルとして再定義 (Z1)

### B9. v2.1 final (GLM critique 統合 2026-05-13)
- **N9 fix (重要)**: `NEXT_PUBLIC_PRO_USERS` も漏洩源。**`PRO_USERS` server-only env** に変更、Edge Middleware で判定。Pro tier flag は middleware が response header `X-Tier: pro` 等で client に伝える、または `/api/me` で取得
- **F12 を Phase 2 へ延期 (dead code 削除)**: 全員 Pro 付与の現状で 50/月 counter は無意味。実装せず spec から外す。スライス再計算: S9 から +1% 削減 (4→3%)、S10 が +1% 拡張 (3→4%)。累計は不変 (100%)
- **B9-Privacy**: Privacy policy 必須記載 (S11 で本文化)
  - Cursorvers = データコントローラ
  - Drive OAuth scope = `drive.file` のみ (既存ファイル non-readable)
  - 撮影画像は Cursorvers サーバーを通過しない (client → Drive 直送)
  - **Pro tier の OCR 利用時のみ**、画像が Cursorvers API Route 経由で Gemini API に一時送信される
  - Gemini API は Google の paid tier (学習に使われない旨を `https://ai.google.dev/gemini-api/terms` から引用記載)
  - 抽出データは Cursorvers 側に永続保存しない (Edge log は content 除外)
- **R13 (新リスク)**: 同一端末家族共有 → 「別アカウントで再認証 / 全データクリア」ボタンを settings 画面に必須 (既に S5 で実装済、明示確認)
- **R14 (新リスク)**: Vercel Hobby 10s timeout + 4.5MB payload → S8 で **撮影時に必ず 2MB 以下に再圧縮** + OCR API call は **30s 上限**でタイムアウト UX (失敗時 fallback = 手動入力 form)
- **委譲 risk 対策**: gemini-flash 進捗遅れ対策として S6-S11 各 brief を **150-200 行の詳細仕様書** にして渡す (S1-S5 で確立した brief 様式を踏襲、ambiguity を排除)

### B10. v2.1 確定スライス計画
| Slice | 内容 (final) | 増分 | 累計 |
|---|---|---|---|
| S6 | Cursorvers branding (header/footer/LP) + tier flag system (server-only env + Middleware + `/api/me`) + privacy/terms placeholder | +5% | 65% |
| S7 | 月別フォルダ自動生成 (IDB lock + Drive list query) + 招待 whitelist (Middleware enforce) + JP UI | +10% | 75% |
| S8 | OCR Pro: Vercel API Route (Node.js) + Gemini API multimodal + 撮影時 2MB 再圧縮 + 30s timeout + 失敗時手動入力 form | +15% | 90% |
| S9 | CSV incremental append (upload 時に都度行追加) + 税理士共有 link 生成 (Drive permission API) | +3% | 93% |
| S10 | bundle ≤140 KB hard + Lighthouse ≥95 + a11y audit + 追加 e2e (R13 device clear, R14 OCR timeout) | +4% | 97% |
| S11 | LP コピー仕上 (Cursorvers tone) + Privacy Policy 本文 (B9 記載必須項目) + 利用規約 + 独自ドメイン設定書 + Vercel prod deploy 手順 | +3% | 100% |
