# P0-2: iOS Safari Camera Permission + getUserMedia 互換性 Design

**Date**: 2026-05-14 (FUGUE 3-agent vote、Wave 1 W1-2 採択、前回 P0 で deferred)
**Status**: design + user 検証手順のみ。実装は次 session
**Scope**: iOS Safari (Mobile) と Android Chrome の getUserMedia 差異吸収、camera permission UX 統一

---

## 1. なぜ P0 か

配布対象:

- **香西杏子氏** (ハートキッズライフリンク代表): iPhone 利用想定 (memory `cursorvers_kozai_first_advisory`)
- **長谷川拓也氏** (結のぞみ病院 診療部長): スマートフォン利用想定、iPhone or Android 不明
- **大田原正幸 dogfood**: iPhone

→ **配布対象の 50%+ が iOS Safari**。Mobile Safari で getUserMedia が失敗する / 想定外の UX が発生すると、配布直後の問い合わせ集中 → 信頼毀損。

---

## 2. 既知の iOS Safari 制約 (2026 年時点)

### 2.1 getUserMedia 仕様差

| 項目 | iOS Safari | Android Chrome | gdrive-uploader 現状 |
|---|---|---|---|
| **HTTPS 必須** | ✓ (localhost 除く) | ✓ | ✓ Vercel 経由なので問題なし |
| **HTML5 element 必須** | `<video>` element に attach されないと play() 不可 | autoplay 寛容 | ❓ 要確認 |
| **user gesture 必須** | button click 等の **user gesture event handler 内** でのみ呼び出し可 | より緩い | ❓ 要確認 |
| **`playsinline` 属性必須** | これがないとフルスクリーン強制 | 不要 | ❓ 要確認 |
| **back camera default** | `facingMode: "environment"` で back camera、無指定で front camera | 同じ | ❓ 要確認 |
| **permission UI** | site permission がブラウザレベル (Settings.app からも管理可)、初回プロンプト 1 回限り | サイトごと in-page prompt | UI 説明文ありかどうか要確認 |
| **MediaRecorder 対応** | iOS 14.3+ で対応 (audio memo S10 で使用) | 古くから対応 | iOS 14.3 未満は audio memo 非対応 |

### 2.2 過去事例 (一般的に知られている)

- **Black screen issue**: `<video autoplay playsinline muted>` がないと iOS では camera stream が表示されない
- **HTTPS 必須**: 開発時 `http://192.168.x.x:3000` は iOS で動かない (mDNS / Network 経由でも HTTPS 要)
- **getUserMedia constraint negotiation**: iOS は server-side video resolution constraint に厳しく、`{video: true}` でなく `{video: {facingMode: "environment"}}` を推奨
- **iframe 内の制約**: iOS Safari で iframe 内の getUserMedia は親と同じ origin 必須

---

## 3. 既存実装 audit

実装本体を読まずに doc 化したが、**次 session で必ず以下を grep + 確認** する:

```bash
# Search points
grep -rn "getUserMedia" app/
grep -rn "<video" app/
grep -rn "playsinline" app/
grep -rn "facingMode" app/
grep -rn "navigator.mediaDevices" app/
grep -rn "MediaRecorder" app/
```

期待する見つけ物:

1. `app/page.tsx` (or `app/components/Camera.tsx` 等) で `navigator.mediaDevices.getUserMedia({...})` 呼び出し
2. `<video>` element の attribute 設定 (autoplay / playsinline / muted)
3. error handling (`NotAllowedError` / `NotFoundError` / `NotReadableError` / `OverconstrainedError`)

確認後、不足項目を修正する patch を起こす。

---

## 4. 推奨実装 (次 session)

### 4.1 getUserMedia constraint 推奨

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: { ideal: "environment" }, // back camera 優先、fail 時 front
    width: { ideal: 1920, max: 4096 },
    height: { ideal: 1080, max: 2160 },
  },
  audio: false, // capture はサイレント、音声メモは別 stream で
});
```

- `ideal` だと iOS が緩く満たす (`exact` だと OverconstrainedError 多発)
- back camera 優先で「撮影」UX に統一

### 4.2 `<video>` element 推奨

```jsx
<video
  ref={videoRef}
  autoPlay        // Mobile では autoplay 必須 (user gesture で start 後)
  playsInline    // iOS で fullscreen 強制 を回避
  muted          // autoplay の precondition (iOS 厳格)
/>
```

### 4.3 error handling 分岐

| Error Name | iOS / Android 表現 | UI message |
|---|---|---|
| `NotAllowedError` | 「カメラがブロックされました」 | 「カメラの利用を許可してください。ブラウザの設定から変更できます」+ Safari/Chrome それぞれへのリンク |
| `NotFoundError` | デバイスにカメラなし | 「カメラが見つかりません。本アプリは撮影機能を必要とします」 |
| `NotReadableError` | 他アプリがカメラ使用中 | 「カメラが他のアプリで使用中です。一度閉じてください」 |
| `OverconstrainedError` | constraint 厳しすぎ | fallback で `{video: true}` を再試行 |
| `SecurityError` | HTTPS 違反 | (production では発生しないはず、開発時のみ) |
| `AbortError` | user が cancel | silent |

### 4.4 permission 拒否後の recovery UX

iOS Safari で一度 deny した後の recovery flow:

1. UI 上に「カメラがブロックされています」+ 「設定」ボタン
2. 「設定」ボタンを押すと:
   - iOS: `Settings.app → Safari → Camera` へ移動を促す step-by-step ガイド (in-page modal)
   - Android: `chrome://settings/content/camera` (sub-domain wide setting) へのリンク
3. 設定変更後、PWA に戻ったら user が再度 capture button を押すと再 prompt

---

## 5. user 検証手順 (本 session で deliverable)

deploy 完了後 (DEPLOY.md A6 と同時 or 直後)、user が以下を実機で検証:

### 5.1 iPhone Safari (大田原氏 + 香西氏で実施)

- [ ] HTTPS で Vercel URL を開く (custom domain でも `*.vercel.app` でも)
- [ ] sign in → camera button → 「カメラの使用を許可しますか」プロンプト表示
- [ ] 「許可」→ back camera (アウトカメラ) が起動、画面に映像が表示される
- [ ] **フルスクリーン強制されない** (← playsinline 確認)
- [ ] 撮影 → upload 成功
- [ ] 一度 permission を deny → settings.app → Safari → camera → 復帰 → 再 prompt なく直接 capture へ
- [ ] 別アプリ (例: カメラアプリ) を起動した状態で gdrive-uploader を開く → エラーメッセージが妥当か (NotReadableError)
- [ ] 横向き撮影 → upload 後 Drive 上で正しい orientation
- [ ] iOS 14.3 未満の device (該当者いれば) → audio memo button が gracefully disable される

### 5.2 Android Chrome (長谷川氏可能性あり)

- [ ] 上記と同等の手順、フルスクリーン期待値の違いを許容
- [ ] Android `Camera2 API` 経由の高解像度 capture が機能
- [ ] background tab で camera が pause される挙動を確認

### 5.3 報告フォーマット (検証完了時)

`OPERATIONS.md §3.5` (次 session で追加) に検証結果 table を入れる:

```markdown
| Device | OS | Browser | 撮影 | upload | permission UX | NotReadable | 全体 |
| iPhone 15 | iOS 17.5 | Safari | ✓ | ✓ | ✓ | ✓ | ✓ |
```

---

## 6. 既存 e2e との関係

`e2e/smoke.spec.ts` の B1 expansion (commit `78cc3a0`) は **chromium のみ**。

iOS Safari / Android Chrome の実機テストは Playwright Webkit project + Android emulator で代替可能だが:

- Playwright Webkit ≠ iOS Safari (engine は近いが完全互換ではない、特に MediaRecorder)
- Android emulator は CI ではセットアップが重い

→ **iOS Safari は実機テスト**, **Android は Playwright Pixel 7 project で代替** という方針を採用 (Phase β で `playwright.config.ts` の 5 projects を有効化、Phase α では device test に集中)。

---

## 7. リスク

| Risk | 影響 | 対策 |
|---|---|---|
| iOS 14.x の利用者がいる | MediaRecorder 動作せず audio memo が壊れる | UI で feature detect + 機能 disable |
| Safari Private Browsing | IndexedDB が memory-only、再起動で消失 | Storage Persistence API request + warning |
| iOS Lockdown Mode | 高度なセキュリティ設定 | エラー時に Lockdown Mode 検出して説明 message |
| Android Webview embedded | LINE 内ブラウザ 等 | UA detect + 「外部ブラウザで開いてください」prompt |

---

## 8. 関連

- [DEPLOY.md](../DEPLOY.md) §Step 5 smoke test (現状は chromium 想定)
- [OPERATIONS.md](../OPERATIONS.md) §2 A6 smoke test
- [DISTRIBUTION_EMAIL_DRAFT.md](../DISTRIBUTION_EMAIL_DRAFT.md) §A 「OAuth 同意画面で『未確認のアプリ』」記載 (iOS でも同じ表示)
- memory `feedback_thumbnail_render_full_title.md` (UI text 完全反映原則、camera permission message にも適用)

## 9. ステータス

| Phase | Trigger | Content |
|---|---|---|
| Current | — | design + user 検証手順 doc 完納 |
| Phase α | smoke test 実施前 (deploy 後 0-3 日) | 既存実装 audit + 修正 patch |
| Phase β | 検証フェーズ 1 週間 | Android Playwright project 有効化 |
| Phase γ | 公開リリース判断 | LINE / Twitter 内ブラウザ等の外部ブラウザ誘導 UX |
