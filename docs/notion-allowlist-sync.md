# Notion ↔ INVITE_ALLOWLIST 同期 Design Doc (B4)

**最終更新**: 2026-05-13 (FUGUE multi-agent vote 後 / B4 採択)
**ステータス**: design only — 実装は user 判断後
**目的**: Cursorvers Notion advisor DB に追加された連絡先を `INVITE_ALLOWLIST` (Vercel env + GCP OAuth Test users) に自動で反映する経路を確立し、招待運用のラグと PII 漏れを減らす。

---

## 1. 現状 (2026-05-13)

| 経路 | 状態 |
|---|---|
| ROSTER → INVITE_ALLOWLIST | **手動コピペ** (`INVITE_ALLOWLIST_NOTES.md` 参照、user が `.env.local` + Vercel Dashboard に投入) |
| ROSTER → GCP Test users | **手動コピペ** (Console UI で一件ずつ追加) |
| Notion advisor DB → ROSTER | **手動** (memory `cursorvers_client_roster.md` の方針: ROSTER は連絡先 PII を持たず Notion を指すポインタのみ) |

問題:
- 香西氏 / 長谷川氏のような single advisor 追加でも 3 箇所同期 (Notion / Vercel / GCP)
- 100 user 検証フェーズで人手は破綻
- GCP と INVITE_ALLOWLIST の片側だけ更新すると `access_denied` の運用事故
- PII (email) を ROSTER に持たない方針は、自動同期で逆に「ROSTER bypass で Notion → Vercel/GCP 直結」が筋

---

## 2. 比較した 3 案

### 案 A: Notion MCP 経由 polling (~/.claude/skills/agent-memory or custom)

Cursor MCP の Notion adapter (既 install) を使い、`fugue-` skill か新規 skill で Notion advisor DB を polling、変更があれば Vercel CLI + Google Workspace Admin SDK で同期。

| 項目 | 評価 |
|---|---|
| 実装規模 | 中 (4-6h、MCP 呼び出し + diff 検出 + 2 way push) |
| ランタイム | Claude Code session 内、手動 trigger (`/sync-allowlist`) |
| 信頼性 | Notion MCP の安定性に依存。memory `notion_mcp_status` (作成必要) |
| PII 流出 | Notion ↔ local Mac のみ。中継サーバーなし |
| user 工数 | 月 1-2 回手動 trigger で済む |
| 認証 | Notion = ユーザー個人トークン、GCP = OAuth 2.0 (個人 G アカウント) |

### 案 B: GitHub Actions cron + Notion API + Vercel REST API + Google Admin SDK

private repo (Cursorvers 内部 ops) の GHA で毎日 cron。Notion API で advisor DB を読み、Vercel `PATCH /v1/projects/<id>/env/<key>` で `INVITE_ALLOWLIST` を更新、Google Admin SDK で Test users 同期。

| 項目 | 評価 |
|---|---|
| 実装規模 | 大 (8-12h、GHA workflow + 3 API client + secrets 5 本管理) |
| ランタイム | GitHub-hosted runner、定期実行 |
| 信頼性 | 各 API の rate limit / token expiry に依存 |
| PII 流出 | GHA secrets / GitHub log に email が露出する可能性。要 audit |
| user 工数 | ゼロ (初期 setup 後は自動) |
| 認証 | Notion = integration token / Vercel = team token / Google = service account (workspace admin 権限要) |

### 案 C: Notion → CSV export 半手動 + node script

Notion で「allowlist 対象」プロパティの advisor を CSV export → local `scripts/sync-allowlist.mjs` (Cursorvers_Platform/ops 配下) で Vercel + GCP に投入。

| 項目 | 評価 |
|---|---|
| 実装規模 | 小 (1-2h、CSV parser + 2 API client) |
| ランタイム | local mac、user が export → script 実行 (5 分) |
| 信頼性 | high (single-process、log は user 手元) |
| PII 流出 | local CSV のみ、即削除運用すれば最小 |
| user 工数 | 月 1-2 回、export + script 起動 (~10 min) |
| 認証 | Vercel CLI + GCP gcloud (既 install 済) |

---

## 3. 推奨案 = **C (Lean ハイブリッド)**

理由:
1. **invite-only 検証フェーズ (100 user 上限)** では月 1-2 回の手動同期で十分。GHA cron (案 B) は overkill。
2. memory `feedback_minimize_claude_use_opencode.md` (Claude は orchestrator) + memory `secrets_brushup_2026_04_20` (secrets canonical = Keychain) の方針に沿う。GHA secrets を別管理に増やしたくない。
3. 案 A (Notion MCP) は将来候補だが、`notion_mcp_status` の安定性検証が未済 → MVP には案 C で実証 → 100 user 到達後に案 A or B に昇格。
4. PII 流出最小: local CSV を script 実行直後に削除する。Notion 側に PII 残るのは元々のソース。

---

## 4. 推奨実装 (案 C MVP)

### 4.1 scripts/sync-allowlist.mjs (Cursorvers_Platform/ops/scripts 配下に置く)

```
入力: CSV path (`--csv ./advisors-2026-05-13.csv`、列: name,email,status,scope)
処理:
  1. CSV を読み込んだ直後に `process.on("exit"|"SIGINT"|"SIGTERM", cleanup)` を仕掛け、
     終了経路に関わらず CSV ファイルを `fs.unlinkSync` で削除する (try/finally + signal trap、defense-in-depth)
  2. status=="Active" or "Invited" の行を抽出
  3. scope=="capture" or "all" の行を抽出
  4. email を小文字化 + trim + sort + dedupe → comma-separated string `INVITE_ALLOWLIST`
  5. `--dry-run` flag があれば diff 出力のみ
  6. `--apply` flag で:
     a. **Vercel atomic update を試みる** (PATCH /v9/projects/{id}/env/{envId})。CLI が
        2026-05 時点で atomic update を直接サポートしない場合は、
        b1) deploy が走っていない夜間 (JST 02:00-06:00) を user に再確認、
        b2) `vercel env rm INVITE_ALLOWLIST production --yes` → 即時 `vercel env add` 連続実行、
        b3) 完了直後に `vercel --prod` を deploy し直して env を pin
        (この期間 ~10 秒、env 欠落 window で同時 access した user は access_denied)
     b. GCP: Console UI 自動化なし。stdout に未同期 email リストを出力し、user が手動投入
  7. cleanup: CSV を `unlink` (`process.exit` 経路でも実行されるよう trap 済)
出力: 各 step の diff (added/removed email count)、CSV delete 確認、env update window の実時間 (ms)
```

### 4.2 Notion CSV export 手順

1. Cursorvers Notion → "Advisors" DB を開く
2. View を "Allowlist sync" (新規作成、フィルタ: status ∈ {Active, Invited}、scope ∈ {capture, all}、列: name/email/status/scope のみ)
3. `…` → Export → CSV → 一時 file 保存
4. `node sync-allowlist.mjs --csv <path> --dry-run` で diff 確認
5. 問題なければ `--apply` 実行
6. GCP Console を開いて、stdout に出力された未同期 email を手動投入

### 4.3 想定運用頻度

- 月 1-2 回 (新規 advisor 追加時 + 月次 audit)
- 5/19 長谷川氏面談 後 (B 配布前) に初回実行を推奨

---

## 5. 将来昇格パス

| Trigger | 移行先 |
|---|---|
| user 数 50+ / 月次 同期では追いつかない | 案 A (Notion MCP polling) |
| Cursorvers 採用 (社員 5+) | 案 B (GHA cron、複数人で共有) |
| GCP verification 通過 + 100 user 突破 | OAuth audit log と統合し、案 B + 監査トレイル |

---

## 6. リスク / 既知の問題 (critic 合議反映)

- **Vercel env 欠落 window** (★ critic must-fix): `env rm` → `env add` 間の数秒間、`INVITE_ALLOWLIST` が空欄になる時間帯が発生する。production user が同時刻にログインすると全員 `access_denied`。
  - **第 1 対策 (atomic 化)**: Vercel REST API `PATCH /v9/projects/{id}/env/{envId}` (atomic) が使えるか先に検証 (CLI でなく `fetch` 直叩き、`VERCEL_API_TOKEN` 必要)
  - **第 2 対策 (時間隔離)**: atomic が使えない場合は JST 02:00-06:00 (advisor 不在帯) に実行
  - **第 3 対策 (deploy pin)**: env update 直後に `vercel --prod` を打ち、新 env を確実に pin する (env-only 変更だと cold-cached function が古い env を使う恐れ)
- **GCP Console UI 自動化なし**: gcloud には OAuth consent screen の Test users 編集 API がない (2026-05 時点)。Console 操作は手動が必須。Admin SDK でカバーするには workspace 配下の domain restriction が必要
- **CSV PII 残留** (★ critic must-fix): `unlink` の単発呼び出しでは crash 時にローカルに残る。**`process.on("exit"|"SIGINT"|"SIGTERM", cleanup)` 必須**、try/finally と signal trap の二重保証
- **email case-sensitivity の落とし穴**: PWA `middleware.ts` が `.toLowerCase()` をかけている前提だが、Vercel env 投入時も小文字化して defense-in-depth
- **Notion API rate limit**: 案 A/B 昇格時に考慮 (3 req/sec)
- **Notion 側 status 値の表記揺れ**: "Active" vs "active" vs "アクティブ" 等を吸収する正規化レイヤを script に入れる (`status.trim().toLowerCase()` ベース)

---

## 7. 関連 doc / memory

- [OPERATIONS.md](../OPERATIONS.md) §4 (INVITE_ALLOWLIST 投入候補)
- [INVITE_ALLOWLIST_NOTES.md](../INVITE_ALLOWLIST_NOTES.md) (現状の手動投入)
- memory `cursorvers_client_roster.md` (ROSTER と PII 切り分け方針)
- memory `cursorvers_kozai_first_advisory.md` (香西氏案件)
- memory `cursorvers_yuinozomi_hasegawa_localllm.md` (長谷川氏案件)
- memory `secrets_brushup_2026_04_20.md` (secrets canonical)

---

## 8. 着手判断

本 doc は **design のみ**。実装は以下のいずれか:

- [ ] **MVP 着手** (案 C): 100 user 検証中に手動運用が重くなったら、別 FUGUE run で `Cursorvers_Platform/ops/scripts/sync-allowlist.mjs` を起票
- [ ] **延期**: 月 1-2 回の手動コピペで運用継続、案 A/B/C いずれも見送り
- [ ] **昇格**: invite が 30 件超えたら案 A 着手 (Notion MCP polling)
