# HANDOVER — gdrive-uploader (auto context save 2026-05-12)

## 目的
スマホで撮った写真を、指定の Google Drive フォルダへ自動アップロードする PWA web app。
**堅牢・軽量・シェア対応 (multi-user, zero backend)**。

## 現状
- **達成度: 75% (S1+S2+S3 完了、残 2 slices: S4 in-flight, S5)**
- Project root: `/Users/masayuki/Dev/gdrive-uploader/`
- Git: local-only repo (origin 未設定)、3 commits (S1, S2, S3)
- spec.md v1.1 lock (Phase 1 多エージェント synthesis 反映済)
- Build: ✅ 91.7 kB First Load JS / Test: ✅ 4/4 passing
- 委譲実績: cursor-agent direct (S1, S2), gemini flash (S3) — 両者で交互に進行

## 採用 verdict (Phase 0 結論)
**自作 PWA (Next.js 14 + Drive API direct)** — 7 候補を 6 軸 60 点で採点、48/60 で 1 位。
競合既製品 (PhotoSync/Autosync/Uppy+Companion/Filestack/Zapier/IFTTT/Make) は
「スマホ web 完結 × $0/月 × privacy」を同時に満たさず却下。

## スライス計画 v1.1 (5 slice)
| Slice | 内容 | 増分 | 累計 | 状態 |
|---|---|---|---|---|
| S1 | scaffold + PWA shell + CSP + errorBoundary + system font | +20% | 35% | ✅ 完納 (commit 済) |
| S2 | OAuth GIS drive.file + 401 silent refresh + `?folder=` query + deviceId | +20% | 55% | 🟡 次回 |
| S3 | camera capture + HEIC→JPEG (browser-image-compression) + EXIF + blob revoke | +20% | 75% | ⏳ |
| S4 | Drive resumable upload + concurrent cap 2 + session-URL persist + sha1-8 filename (**MVP**) | +30% | 90% | ⏳ |
| S5 | Lighthouse ≥90 + Playwright e2e 4 シナリオ + Vercel prod + share-link doc | +10% | 100% | ⏳ |

想定残時間: 1 slice 25-40 分 × 4 = **2-2.5 時間で 100%**

## 委譲インフラ運用メモ (重要)
- **Codex `delegate.js`**: stdin hang で 600s timeout、empty output → **使用禁止 (S1 で再現確認)**
- **cursor-cli direct (`cursor-agent -p --force --yolo`)**: ✅ 動作確認、推奨パス。`-f` (delegate-cursor.js wrapper) は 60s timeout で短時間タスクのみ
- **copilot CLI**: `model_not_supported` で broken (2026-05-12 時点)、quota or auth 不明
- **opencode CLI**: `--dangerously-skip-permissions` は hook が deny、interactive 必要
- **gemini CLI**: 未試験、`-y` か `--yolo` で auto-approve、free-tier flash で OK
- **GLM `general-reviewer`**: critique only、write 不可。`--ref-only` で context 圧縮可
- **Manus**: research only、162 credits/call 高コスト、初回調査のみ使用済

## Phase 1 で確定した hard contract (LLM coding agent への必読制約)
spec.md A3 / A6-A8 参照。要点:
1. **GIS access token 1hr 期限**: SPA は refresh token 不可 → 401 hook で `tokenClient.requestAccessToken({prompt:''})` silent refresh
2. **`drive.file` scope は既存ファイル検索不可** → filename は `<JST日時>-<deviceId8>-<sha1_8>.jpg` で衝突回避
3. **iOS Safari visible-tab 必須**: BG sync は Phase 2 延期、`wakeLock.request('screen')` 試行
4. **HEIC → JPEG**: `browser-image-compression` で quality 0.85 変換、EXIF orientation baked-in
5. **Resumable session URL**: 即 IndexedDB persist、reload 耐性、`createdAt` + 6 日 TTL
6. **SW 登録**: `'use client'` SWRegistry + `useEffect` (SSR/Hydration 回避) ← S1 実装済
7. **依存追加**: `browser-image-compression` のみ (S3)。`lodash`/`moment`/`axios`/`exifr` 禁止

## シェア対応 (A6)
- バックエンドなし、同じ URL を共有するだけで複数人が独立利用
- URL `?folder=<driveFolderId>` で folder pre-fill
- 「オーナーが Drive folder を編集権限で共有」 → 招待者の OAuth で書込可能 (`drive.file` 範囲内)

## S2 への引継 (次セッション最初の delegation)
**Delegate**: cursor-agent direct (推奨) — `cd /Users/masayuki/Dev/gdrive-uploader && cursor-agent -p --force --yolo "<brief>"`

**S2 brief 要点**:
1. `app/lib/gis.ts` — Google Identity Services client. `initTokenClient({client_id, scope:'https://www.googleapis.com/auth/drive.file', callback})`. token を IndexedDB store `auth` に `{access_token, expires_at, scope}` で保存
2. `app/lib/idb.ts` — minimal IndexedDB wrapper (native `indexedDB.open`、no `idb` lib 依存)。stores: `auth`, `uploadSessions`, `pendingUploads`, `config`
3. `app/lib/fetch-wrapper.ts` — 401 hook で token refresh トライ、5xx → exponential backoff
4. `app/components/SignInButton.tsx` — `'use client'`、click で GIS popup、signed-in UI 表示
5. `app/page.tsx` — `useSearchParams` で `?folder=` を読み、`config` store に pre-fill。SignInButton を有効化、`📷` ボタンは S3 までは disabled のまま
6. `app/lib/device.ts` — `crypto.randomUUID()` localStorage に保存、8 文字 prefix を返す
7. Env: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` を `.env.local` に。GCP 側で OAuth 2.0 Client ID (Web app, authorized origin に http://localhost:3000 と Vercel domain) を作成
8. README に「GCP 設定手順」セクション追加
9. `pnpm build` green まで verify

**受入基準**: ログインボタン → Google consent → IndexedDB に token 保存 → "Signed in as <email>"。`?folder=xxx` で folder pre-fill (UI に表示)。401 path は手動 test 困難なので unit test (Jest) を 1 件追加。

## 既知の保留事項
- GCP OAuth Client ID 未作成 (S2 開始時に user に依頼、または README で手順明記)
- Vercel project 未作成 (S5 で実施、user の Vercel アカウント必要)
- `kpi-review-2026-05-09.md` 等が worktree 親 dir に存在するが、本 project には無関係

## Token saving 戦略 (継続)
- Claude = orchestrator only、直接 Write/Edit は禁止 (FUGUE hook 強制)
- 1 slice = 1 delegate (cursor-agent direct が現状 best)
- 完了通知ベースで再開、polling せず
- spec.md 更新は orchestrator OK (markdown 扱い、hook 通過)
