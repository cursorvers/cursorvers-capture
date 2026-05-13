# Cursorvers Codex Gateway 接続 SOP (B6)

**最終更新**: 2026-05-13 (FUGUE multi-agent vote 後 / B6 採択)
**ステータス**: SOP only — Gateway repo の Phase B-2+ 完成後に着手
**前提**: `~/Dev/cursorvers-codex-gateway/` (commit `a37ef62`) が deploy 済で、`https://gateway.cursorvers.com/v1/*` (案) でアクセス可能になっている
**重要発見**: PWA 側の [`app/lib/codex-app-server.ts`](../app/lib/codex-app-server.ts) は **既に env switch 設計** (env 未設定 → stub fallback、設定 → 本番 fetch)。本 SOP の範囲では PWA code 変更は **不要**

---

## 0. 着手判断

invite-only 検証フェーズで Tier B (OCR / 音声 / advisory) を実稼働させる場合のみ着手。それ以前は stub mode で十分動作する。

---

## 1. 現状の env 切替設計

`codex-app-server.ts` は 4 関数 (`dispatchToCodex` / `requestAudioTranscript` / `requestOcr` / `requestAdvisory`) いずれも以下のパターン:

```ts
const endpoint = process.env.OPENAI_APPS_SDK_<KIND>_ENDPOINT;
const apiKey = process.env.OPENAI_APPS_SDK_KEY;
if (!endpoint || !apiKey) {
  console.warn('... Running in stub mode.');
  return /* stub fixture */;
}
// 本番 fetch
```

つまり **env を投入すれば自動で gateway 経由に切り替わる**。

---

## 2. 必要 env (Vercel Dashboard, Production scope, Server-only)

| Env | 値 (案) | 役割 |
|---|---|---|
| `OPENAI_APPS_SDK_KEY` | `<gateway-issued-bearer>` | Gateway 側 `GATEWAY_AUTH_KEYS` allowlist に存在する 1 本 (PWA 専用 token) |
| `OPENAI_APPS_SDK_ENDPOINT` | `https://gateway.cursorvers.com/v1/chat` | `dispatchToCodex` (Codex chat) |
| `OPENAI_APPS_SDK_AUDIO_ENDPOINT` | `https://gateway.cursorvers.com/v1/audio` | `requestAudioTranscript` (Whisper 等) |
| `OPENAI_APPS_SDK_OCR_ENDPOINT` | `https://gateway.cursorvers.com/v1/ocr` | `requestOcr` (Vision OCR) |
| `OPENAI_APPS_SDK_ADVISORY_ENDPOINT` | `https://gateway.cursorvers.com/v1/advisory` | `requestAdvisory` (advisory chat) |

**注意**:
- 5 つ全て `NEXT_PUBLIC_` prefix なし (server-only、client bundle に焼かない)
- 一部だけ投入すると、未投入 endpoint だけ stub mode で動く mixed-mode が成立する (Phase B-2 → B-3 → B-4 の段階導入)
- `OPENAI_APPS_SDK_KEY` だけ投入で endpoint 未投入は意味なし (key だけでは stub に落ちる)

---

## 3. 既知の Schema 不整合 (Phase B-2 までに解消)

Gateway scaffold (`a37ef62`) と PWA 側の expected response が **完全一致していない**:

| 関数 | PWA expected | Gateway scaffold actual |
|---|---|---|
| `dispatchToCodex` | `{chatback_text, suggested_tags, updated_metadata}` (`CodexChatbackResult`) | `{text, usage, warnings}` (chat endpoint stub) |
| `requestAudioTranscript` | `{transcript, cleaned_text, summary?}` (`AudioResult`) | 未実装 (Phase B-3) |
| `requestOcr` | `{confidence, extracted_text, structured}` (`OcrResult`) | 未実装 (Phase B-3) |
| `requestAdvisory` | `{reply}` (string) | 未実装 (Phase B-4) |

**解消方針** (Phase B-2 着手時の判断):
- 案 a: Gateway 側で PWA 互換のレスポンス schema を返す (gateway を PWA の REST contract に合わせる)
- 案 b: PWA 側に adapter 層を入れ、gateway の generic `{text, usage, warnings}` から `CodexChatbackResult` に変換
- 案 c: 両者を一段抽象化した `unified` schema を新 spec として起こす

3 案いずれかを **Phase B-2 着手時の Spec Master Q&A で確定** する。本 SOP は schema 不整合がある前提で運用前 audit 必須を明示。

---

## 4. 段階導入手順 (推奨)

Tier B 機能を一気に有効化せず、4 関数を 1 つずつ切替える:

### 4.1 chat 1 関数のみ先行 (Phase B-2 GA 時)

1. Gateway 側で `/v1/chat` が PWA 互換 (`{chatback_text, suggested_tags, updated_metadata}`) を返すよう Phase B-2 で実装 (or PWA 側 adapter を入れる)
2. Vercel に `OPENAI_APPS_SDK_KEY` + `OPENAI_APPS_SDK_ENDPOINT` の 2 本を投入
3. `vercel --prod` で再 deploy
4. smoke: 自分の Drive に upload → 数秒後に chatback が stub でない返信になることを確認
5. 他 3 endpoint (audio / OCR / advisory) は env 未投入のまま stub fallback 継続

### 4.2 audio + OCR (Phase B-3 GA 時)

Gateway 側で 2 endpoint 実装後、env 2 本追加投入。各機能ごとに smoke。

### 4.3 advisory (Phase B-4 GA 時)

同様。

---

## 5. Gateway 側 deploy (前提条件、別 repo)

`~/Dev/cursorvers-codex-gateway/` (commit `a37ef62`、master、origin 未設定)。

Gateway を本番運用する前に user が決める:

1. **deploy 先**: Vercel project? Cloudflare Worker? Fly.io?
2. **origin 設定**: Cursorvers Org に private repo 作成 (`cursorvers/cursorvers-codex-gateway`) → `git remote add origin git@github.com:cursorvers/cursorvers-codex-gateway.git && git push -u origin master`
3. **GATEWAY_AUTH_KEYS**: PWA 専用 + admin/test 用で 2-3 本生成 (`openssl rand -hex 32` 等)、Gateway 側の env (shell / hosting dashboard) に投入

Gateway 側の詳細は別 doc `~/Dev/cursorvers-codex-gateway/README.md` 参照。

---

## 6. rollback (gateway 切替で問題発生時)

```bash
# 該当 endpoint の env を Vercel から削除すれば即 stub fallback に戻る
vercel env rm OPENAI_APPS_SDK_ENDPOINT production --yes
vercel --prod
```

数十秒で stub mode に復帰。サービス断は発生しない (stub fixture が返る)。

---

## 7. 配布メール / privacy への反映

Tier B が gateway 経由になった時点で、[DISTRIBUTION_EMAIL_DRAFT.md](../DISTRIBUTION_EMAIL_DRAFT.md) §A の以下記述を更新:

> 「将来、画像内のテキスト読み取り (OCR) や音声要約、相談チャット等の追加機能を有効化された場合に限り、対象データが当社が運営する別サーバー経由で処理されます。**現時点ではこれらの機能は未稼働** で、画像の流れは『端末 → Google Drive のみ』です」

→ 「これらの機能を有効化された場合に限り、対象データが当社が運営する Cursorvers Codex Gateway (場所) 経由で処理されます」等に更新。
[privacy page](../app/privacy/...) (processor/controller 記載) も併せて見直し。

---

## 8. 監視 / observability (Phase B-5 で本格化)

Gateway 経由になったら以下を計測:

- Gateway 側: per-key request rate、`/v1/chat` の 5xx 率、p50/p99 latency
- PWA 側: stub fallback への落ち込み率、`AbortError` 発生率
- 出力チャネル: 暫定で Vercel logs + Gateway 側 stdout、本格化は Sentry or OpenObserve に統合 (Phase B-5)

memory `sentry-heal` skill が将来 trigger 候補。

---

## 9. 関連 doc

- [docs/codex-gateway-spec.md](codex-gateway-spec.md) (Phase A spec、本 SOP の前段)
- [app/lib/codex-app-server.ts](../app/lib/codex-app-server.ts) (PWA 側 caller、4 関数)
- [OPERATIONS.md](../OPERATIONS.md) (検証フェーズ SSOT)
- `~/Dev/cursorvers-codex-gateway/` (別 repo、scaffold commit `a37ef62`)
- `~/.claude/state/runs/fugue-codex-gateway-2026-05-13/phase-b-summary.md` (Phase B-1 完納記録)
- memory `reference_openai_apps_sdk_protocol.md` (Apps SDK = MCP の wire 事実)

---

## 10. 着手判断

- [ ] **Phase B-2 着手** (chat endpoint 本実装 + adapter): 別 FUGUE run。実装規模 2-3h。先に Schema 不整合 §3 の案 a/b/c を確定
- [ ] **延期**: invite-only 検証中は stub mode で十分。Tier B 機能の使用ログが集まってから優先度判断
- [ ] **Tier B 廃止判断**: 検証フィードバックで「OCR/音声/advisory 不要」と判明したら、PWA から該当機能を抜く (Phase B-7 候補)
