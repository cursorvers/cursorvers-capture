# Tier B Implementation Plan: Schema Resolution + Production Switch (P2-2 + P2-3)

**Date**: 2026-05-14 (FUGUE 3-agent vote、Wave 2 W2-2 採択、OpenCode 推奨)
**Status**: implementation plan doc only。実際の Phase B-2 着手は別 FUGUE run + Gateway repo connection 確定後
**Scope**: Cursorvers Codex Gateway (別 repo) と gdrive-uploader PWA の Tier B endpoint を接続するための schema 合意 + 段階導入計画

---

## 1. 現状 inventory

### 1.1 PWA 側 (app/lib/codex-app-server.ts)

4 関数、いずれも env 未設定で stub fallback、設定で本番 fetch:

| 関数 | env | expected response |
|---|---|---|
| `dispatchToCodex` | `OPENAI_APPS_SDK_ENDPOINT` + `OPENAI_APPS_SDK_KEY` | `CodexChatbackResult = { chatback_text, suggested_tags, updated_metadata }` |
| `requestAudioTranscript` | `OPENAI_APPS_SDK_AUDIO_ENDPOINT` + same key | `AudioResult = { transcript, cleaned_text, summary? }` |
| `requestOcr` | `OPENAI_APPS_SDK_OCR_ENDPOINT` + same key | `OcrResult = { confidence, extracted_text, structured }` |
| `requestAdvisory` | `OPENAI_APPS_SDK_ADVISORY_ENDPOINT` + same key | `{ reply: string }` |

### 1.2 Gateway 側 (cursorvers-codex-gateway commit `a37ef62`)

`POST /v1/chat` (stub) のみ実装、response shape:

```ts
{
  text: string;
  usage: { prompt_tokens, completion_tokens };
  warnings: string[];
}
```

audio / ocr / advisory は **未実装** (Phase B-3 / B-4 で起こす)。

### 1.3 不整合 (Phase B-2 着手前 blocker)

| PWA expects | Gateway returns | 差分 |
|---|---|---|
| `chatback_text` | `text` | field 名 |
| `suggested_tags` | (なし) | gateway 側欠如 |
| `updated_metadata` | (なし) | gateway 側欠如 |
| `usage`, `warnings` | (なし、PWA 側無視可) | gateway 側余分 |

→ **そのまま env 投入すると PWA で `result.chatback_text` が undefined**、runtime error 確実。

---

## 2. Schema 整合の 3 案

`docs/gateway-integration.md` §3 で既に提案された 3 案を本 doc で再評価し、**採択 1 案を確定**:

### 2.1 案 a: Gateway 側 を PWA contract に合わせる

```ts
// gateway/src/routes/chat.ts (修正後)
{
  chatback_text: "✓ " + payload.filename + " を保存しました",
  suggested_tags: ["tag1", "tag2"],
  updated_metadata: { processed_at: ISO_string }
}
```

**Pros**:
- PWA 側のコード変更ゼロ
- 既存 PWA stub と同じ response shape を gateway が emulate するので、stub → production の切替が透明

**Cons**:
- gateway は **PWA 専用 endpoint** に縛られる、汎用 gateway としての価値が低下
- 将来 ChatGPT App や別 client が gateway を使う際に、PWA contract に振り回される
- gateway 側 schema が `text` (OpenAI 風) と `chatback_text` (PWA 風) の 2 系統で混乱

### 2.2 案 b: PWA 側に adapter 層を入れる

```ts
// PWA/app/lib/codex-app-server.ts (修正後)
async function dispatchToCodex(payload) {
  // gateway raw response
  const raw = await fetch(endpoint, ...);
  const data = await raw.json();  // { text, usage, warnings }
  // adapter: gateway → PWA expected
  return {
    chatback_text: data.text,
    suggested_tags: [],  // gateway が生成しない場合 PWA 側で空
    updated_metadata: { stub: false },
  };
}
```

**Pros**:
- gateway は汎用 (`text/usage/warnings` のまま、OpenAI 風 standard)
- PWA 側で fallback / default 値を完結に制御
- 将来別 gateway (例: Anthropic, local LLM) への切替が PWA adapter 内で吸収可能

**Cons**:
- PWA に adapter 層が 4 関数分必要
- PWA expected が gateway response より要求多 (suggested_tags 等は adapter で空配列を埋めるが「常に空」になる)
- → suggested_tags 等の **意味的な存在意義が薄まる**

### 2.3 案 c: 第 3 の unified schema を制定

```ts
// 新 spec
{
  display_text: string;    // PWA chatback_text / Gateway text を統合
  metadata: {              // suggested_tags + usage を unify
    tags?: string[];
    tokens?: { prompt, completion };
  };
  warnings: string[];
}
```

両 repo の type を変更し、unified 化。

**Pros**:
- 最も clean、long-term には保守容易
- PWA / Gateway / 別 client いずれも同じ contract

**Cons**:
- 両 repo に breaking change、即時の実装規模 + テスト 大
- 検証フェーズ中の急務とミスマッチ
- 「Phase B-2 着手」を遅らせる

### 2.4 採択: **案 b (PWA adapter)**

**理由**:

1. **段階導入の柔軟性**: chat だけ先行 → audio/OCR/advisory は stub のまま、という mixed mode が PWA adapter で透明に実現
2. **gateway 汎用性維持**: 別 client (ChatGPT Apps SDK 経由など) で gateway を使う将来オプションを残す
3. **検証フェーズの speed**: 案 a は gateway 改修が必要、案 c は両方改修、案 b は **PWA 側のみ 4 関数 adapter** で完結
4. **suggested_tags 等の degradation**: 検証フェーズでは「stub と同じ user 体験」を維持できれば十分、空配列 fallback で UX は変わらない
5. **長期 evolution**: 検証フィードバックで「suggested_tags が欲しい」と分かれば、gateway 側で生成して adapter を簡素化、という反復的改善が可能

---

## 3. Phase B-2 実装計画 (採択案 b に基づく)

### 3.1 Slice α: PWA adapter 層実装 (~3h)

| Slice | 内容 | 規模 |
|---|---|---|
| α-1 | `app/lib/codex-adapters.ts` 新規: 4 関数の **gateway raw → PWA expected** 変換を集約 | 1h |
| α-2 | `app/lib/codex-app-server.ts` を refactor: fetch 後すぐに adapter を通す | 1h |
| α-3 | `__tests__/codex-adapters.test.ts`: 4 adapter の input/output 変換を網羅 | 1h |

### 3.2 Slice β: Gateway 側 chat endpoint を OpenAI 直結に (~2h、別 repo)

別 FUGUE run、`~/Dev/cursorvers-codex-gateway/` で実施:

- `src/routes/chat.ts` を `OPENAI_API_KEY` が設定されていれば OpenAI API (gpt-4o-mini) 直結
- 未設定なら現状の stub 維持
- adapter は不要 (PWA 側で吸収)
- gateway tests 追加 (real OpenAI 呼び出しは optional、CI では mock)

### 3.3 Slice γ: env 投入 + smoke test (~30 min)

- gateway を Vercel に deploy (or Cloudflare Worker)
- gateway URL を PWA Vercel env に投入 (`OPENAI_APPS_SDK_ENDPOINT=https://gateway.cursorvers.com/v1/chat` 等)
- PWA `vercel --prod` で再 deploy
- smoke: 自分の Drive に upload → 数秒後 chatback が stub でない実 OpenAI 返信になることを確認

### 3.4 Slice δ: audio / OCR / advisory の段階導入 (Phase B-3 / B-4)

- δ-1: audio endpoint を Whisper 直結 + PWA adapter
- δ-2: OCR endpoint を Vision 直結 + PWA adapter
- δ-3: advisory endpoint を system prompt + Cursorvers context で構築 + PWA adapter

各 4-6h、別 FUGUE run。

---

## 4. リスク

| Risk | 影響 | 対策 |
|---|---|---|
| adapter で `suggested_tags=[]` が常に空 → UI が空 tag を見せる | UX 品質 | Slice α-3 で UI 側の empty state を確認、必要なら conditional render |
| gateway response が parser を壊す JSON | runtime error | adapter で try/catch + stub fallback、Sentry 報告 (Observability plan と integration) |
| OpenAI API 課金が予想超過 | コスト | Phase B-2 で API key を `OPENAI_PROJECT` 単位で issue、月次 spend cap 設定 |
| Schema 案 b 採用後に案 c が必要と判明 | 後戻り | 案 c migration は adapter 層に閉じ込められる、影響範囲限定 |

---

## 5. 着手 trigger

以下のいずれかで Slice α 着手判断:

- [ ] 検証フィードバック「Tier B (chatback 等) を実稼働させたい」要望 1 件以上
- [ ] 5/29-30 香西氏顧問契約手交時に「OCR 機能要望」が出れば即着手判断
- [ ] 100 user 到達 (OAuth verification 申請と同期)
- [ ] OpenAI API credit が unlock された (現状 `OPENAI_API_KEY` 環境ない可能性)

→ 全て **検証フェーズ完了後 (6/12 以降)** が現実的。本 doc は it までの blueprint。

---

## 6. 関連

- [docs/gateway-integration.md](gateway-integration.md) (env 投入 SOP、Server-only 検証手順)
- [docs/codex-gateway-spec.md](codex-gateway-spec.md) (Gateway repo spec)
- `~/Dev/cursorvers-codex-gateway/` (別 repo、scaffold `a37ef62`)
- [app/lib/codex-app-server.ts](../app/lib/codex-app-server.ts) (PWA 側 4 関数)
- memory `reference_openai_apps_sdk_protocol.md` (Apps SDK = MCP wire fact)
- memory `feedback_phase_a_locked_patch_amendable.md` (Phase A → B amend 原則)

## 7. ステータス

| Phase | Status | Trigger |
|---|---|---|
| Plan (本 doc) | ✅ 完納 | — |
| Slice α (PWA adapter) | ⏳ Deferred | 検証フィードバック / 香西氏要望 |
| Slice β (gateway OpenAI 直結) | ⏳ Deferred | Slice α 並走 (別 repo / 別 run) |
| Slice γ (env 投入) | ⏳ Deferred | Slice α + β 完了 |
| Slice δ (audio/OCR/advisory) | ⏳ Deferred | chat GA 後の追加 phase |
