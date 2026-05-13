# Cursorvers Codex Gateway — 仕様 outline (Phase B 本実装用)

最終更新 2026-05-13 / FUGUE run `fugue-gdrive-uploader-2026-05-13` で WebFetch 結果から起草。

## 背景

`gdrive-uploader` の Tier B 機能 (OCR / 音声要約 / advisory chat) は、現在 `app/lib/codex-app-server.ts` で **stub mode** として実装されている。env (`OPENAI_APPS_SDK_*`) が未設定なら warning ログを出して null/空応答を返す設計。

**Phase B 本実装** = この stub を本物の inference 経路に差し替えること。
当初 spec は env 名から「OpenAI Apps SDK の HTTP endpoint」を想定していたが、WebFetch (2026-05-13) で公式仕様を確認した結果、Apps SDK は **MCP (Model Context Protocol) over Streamable HTTP + OAuth 2.1 + JSON-RPC 2.0** ベースであり、ブラウザ PWA から直接叩く wire format ではないことが判明した。

したがって、本 PWA の Tier B endpoint は「Cursorvers 側で REST→MCP/LLM 翻訳する gateway service」を経由する必要がある。これを **Cursorvers Codex Gateway** (作業名) と呼ぶ。

## 設計方針

- **別 service** (gdrive-uploader 内に建てない)
- Stack 候補: Vercel Edge Function / Cloudflare Workers / Hono + Node / Next.js API route 単独 deploy
- 認証: PWA から送る `Authorization: Bearer <OPENAI_APPS_SDK_KEY>` (現 stub 仕様と互換)
- 内部経路: gateway → (a) OpenAI Apps SDK MCP server (将来), or (b) OpenAI API 直 (chat completions / Whisper / Vision), or (c) Cursorvers 自前 LLM

## 4 endpoints 仕様 (PWA 側 contract から逆算)

PWA の `app/lib/codex-app-server.ts` は 4 endpoints を期待する。Gateway はこれらと互換な REST API を expose する。

### 1. Chat / text completion (`OPENAI_APPS_SDK_ENDPOINT`)

```http
POST <endpoint>
Authorization: Bearer <OPENAI_APPS_SDK_KEY>
Content-Type: application/json
X-Idempotency-Key: <client-generated UUID>  # 任意

{
  "prompt": "<user prompt>",
  "context": { ... },     # 任意
  "model": "<optional>"
}

→ 200 OK
{
  "text": "<response>",
  "usage": { "prompt_tokens": ..., "completion_tokens": ... },
  "warnings": []
}
```

タイムアウト: 30 秒 (PWA 側で abort)

### 2. Audio transcription (`OPENAI_APPS_SDK_AUDIO_ENDPOINT`)

```http
POST <endpoint>
Authorization: Bearer <OPENAI_APPS_SDK_KEY>
Content-Type: multipart/form-data

audio=@<audio-blob>     # webm/opus or wav
language=ja             # 任意

→ 200 OK
{
  "transcript": "<text>",
  "duration_sec": <float>,
  "language": "ja",
  "confidence": <0..1>
}
```

### 3. OCR (`OPENAI_APPS_SDK_OCR_ENDPOINT`)

```http
POST <endpoint>
Authorization: Bearer <OPENAI_APPS_SDK_KEY>
Content-Type: multipart/form-data

image=@<image-blob>
hint=document           # 任意 (document/handwriting/medical-form)

→ 200 OK
{
  "text": "<extracted text>",
  "confidence": <0..1>,
  "structured": { ... }   # 任意 (構造化抽出)
}
```

### 4. Advisory chat (`OPENAI_APPS_SDK_ADVISORY_ENDPOINT`)

```http
POST <endpoint>
Authorization: Bearer <OPENAI_APPS_SDK_KEY>
Content-Type: application/json

{
  "messages": [ {"role": "user", "content": "..."}, ... ],
  "user_tier": "free|pro",
  "topic": "<optional>"
}

→ 200 OK
{
  "reply": "<assistant text>",
  "citations": [ ... ],   # 任意
  "warnings": []
}
```

## エラー応答 (4 endpoints 共通)

```http
4xx/5xx
{
  "error": {
    "code": "<short_code>",
    "message": "<human readable>",
    "retriable": true | false
  }
}
```

PWA 側は `retriable=true` のみ exponential backoff で 2 回まで再試行。

## レート制御 / クォータ (gateway 側で実装)

- per-user (Bearer key 経由で特定) rate limit: chat 10 req/min, audio 5 req/min, OCR 5 req/min
- 課金区分: free/pro を PWA 側で判定 (`/api/me`) し、advisory endpoint で `user_tier` を渡す
- 月次 cap: free=200 req/月、pro=2000 req/月 (Cursorvers 経営判断で調整)

## セキュリティ

- PWA 側 Bearer key (`OPENAI_APPS_SDK_KEY`) は Vercel server-only env として注入、client bundle に焼かない (現状 PWA 実装は server-side proxy 経路前提)
- ※ 現 `codex-app-server.ts` は `process.env.OPENAI_APPS_SDK_KEY` を直接読むため、呼び出し元が API route であることが前提。client-side で呼ばれないこと確認 (S7-S11 で実装済の `/api/codex/*` proxy 経由)
- Gateway 側で webhook signature 検証 (`WEBHOOK_SECRET`) する場合、PWA 側で `X-Cursorvers-Signature` header を付与

## 実装ロードマップ案

| Phase | 内容 | 規模 |
|---|---|---|
| B-1 | Gateway scaffold (Next.js API route 単独 deploy / Hono on Vercel Edge) + Bearer 認証 + 1 endpoint (chat) | 4-6h |
| B-2 | OpenAI API 直結 (chat completion) + tests | 2-3h |
| B-3 | Audio transcription (Whisper) + OCR (Vision) | 4-6h |
| B-4 | Advisory chat (system prompt + Cursorvers context) + citations | 4-6h |
| B-5 | Rate limit + tier gating + monitoring | 3-4h |
| B-6 | gdrive-uploader 側 endpoint 切り替え + e2e | 2-3h |

合計目安: 19-28h (1-2 週間 part-time)

## 本 run 内では実装しないこと

- 本 run (FUGUE 2026-05-13) では **gateway service の実装は行わない**。
- 本 run は spec 起草のみ、`gdrive-uploader` 側は stub mode polish に留める (本実装は別 run / 別 repo)
- gateway repo を新設するタイミングは、Cursorvers infra の方向性 (Vercel monorepo か別 repo か) を user が決めた後

## 参照

- OpenAI Apps SDK: https://developers.openai.com/apps-sdk/
- MCP spec: https://modelcontextprotocol.io/specification
- gdrive-uploader spec v4.1: `../spec.md`
- 現 stub: `../app/lib/codex-app-server.ts`
