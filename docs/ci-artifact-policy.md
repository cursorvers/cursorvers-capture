# CI Artifact Retention Policy (BS-6)

**Date**: 2026-05-14 (FUGUE 3-agent vote 2/3 採択)
**Owner**: 大田原正幸 (Cursorvers Founder)
**Status**: policy-only。GitHub Actions の CI 構築は **origin 未設定の local-only repo** のため deferred、本 doc は origin 化後の前提整備

---

## 1. 現状

- gdrive-uploader は **`master` 直接 commit + origin 未設定** の local-only repo
- CI workflow (GitHub Actions / Vercel CI) は未構築
- 既存 test artifact: `playwright-report/`, `test-results/` (両方 `.gitignore` 済)
- vitest coverage 出力: `coverage/` (`.gitignore` 済)
- e2e screenshot: `test-results/<test-name>/*.png` (失敗時のみ自動生成)

## 2. なぜ今 policy を書くか (regret 防止)

origin 化 → GitHub Actions 導入時に、`actions/upload-artifact` の reten 設定 / 命名規則 / アクセス制御を **その場凌ぎで決める** と、長期的に:

- 古い CI 失敗の screenshot/log を漁れず再現不可
- artifact が 1 ヶ月後に消えて法務 audit に応えられない
- 個人 email 等の PII が CI artifact 内に混入し漏洩経路化

これを **origin 化前** に固めておくことで、初回 CI 設定 commit から正しい形を採用できる。

## 3. ポリシー (origin 化後の CI workflow 設計時に反映)

### 3.1 Artifact 種類別 retention

| Artifact | 形式 | retention | 含まれてはならないもの |
|---|---|---|---|
| Playwright HTML report | `playwright-report/index.html` + screenshots | **30 日** | INVITE_ALLOWLIST email、Bearer token、Drive folder ID |
| Playwright failure trace | `test-results/<test>/trace.zip` | **30 日** | 同上 |
| Vitest coverage | `coverage/lcov-report/` | **14 日** | (coverage 対象 source code は含まれる、PII は構造上含まれない) |
| Build output (`pnpm build`) | `.next/` | **保存しない** (再生成可能) | — |
| pnpm-lock.yaml | (commit に含む) | (git 永続) | — |

### 3.2 命名規則

```
artifact-name: ${{ github.workflow }}-${{ github.run_id }}-${{ matrix.project }}-{kind}
e.g.: e2e-12345-chromium-playwright-report
```

理由: workflow + run_id + matrix で一意、検索性 + retention 経過確認が容易

### 3.3 アクセス制御

- **public repo 化判断は別途**: 現状 invite-only PWA、source 全公開はリスク (INVITE_ALLOWLIST 例 / `gdrive_email` Cookie 設計が露出)
- private repo であれば artifact 自動的に private (GitHub default)
- public repo 化判断時は本 policy §3.1 の PII 条項を **必須 pre-flight check**

### 3.4 secret 漏洩防御 (artifact 内に PII を入れない)

CI で test 実行時:

- env から `INVITE_ALLOWLIST` を expose しない (CI test では `test-key-1` etc の fixture を使う)
- e2e screenshot で email アドレス入力フィールドが視覚露出する場合は CSS で hide or mosaic 適用
- failure log の `console.log` に Bearer token を含めない (既存 codex-app-server.ts の log を再 audit)

### 3.5 audit / 保存延長要件

法務 audit 要件 (Cursorvers 取締役会、契約上の義務、有事の incident response) があれば:

- 該当 run の artifact を local Mac mini に手動 download + `~/Dev/Cursorvers_Platform/ops/audit-artifacts/` 配下に保管
- AES 暗号化 (sops or `openssl enc`)
- 保管期間 = audit 要件次第 (default 3 年、最大 7 年 — 会社法準拠)

## 4. origin 化前の準備 (本 policy で完了)

- ✅ `.gitignore` に `playwright-report/` `test-results/` `coverage/` 追加済 (commit `78cc3a0`)
- ✅ secrets canonical = Keychain `fugue/*` (memory `secrets_brushup_2026_04_20`)
- ✅ CI runner は GitHub-hosted (Linux) 想定、self-hosted は 100 user 突破まで考えない

## 5. origin 化トリガー

以下のいずれかが成立した時に origin 設定 + CI 構築を着手:

- [ ] gdrive-uploader を **Cursorvers Org / GitHub** に upstream する判断 (legal review 後)
- [ ] 共同開発者 (Cursorvers 社員 / 業務委託) を迎え入れる (lone dev 期間 end)
- [ ] 100 user 検証フェーズ完了 + 公開リリース判断

origin 化と同時に:

1. private repo 作成 (`cursorvers/gdrive-uploader`)
2. `.github/workflows/ci.yml` を本 policy §3 準拠で起草
3. 既存 master を `git remote add origin` → `git push -u origin master`
4. 既存 commits の email/secret leak チェック (gitleaks / trufflehog) を初回 CI で必須化

## 6. 関連

- [.gitignore](../.gitignore) (CI artifact path の ignore)
- [HANDOVER.md](../HANDOVER.md) (origin 未設定の local-only repo 前提)
- [OPERATIONS.md §6](../OPERATIONS.md) (後回し項目)
- memory `branch_hygiene_diverged_master.md` (branch hygiene)
- memory `secrets_brushup_2026_04_20.md` (secrets canonical)
- memory `feedback_delete_unused_branches.md` (不要 branch 即削除)

## 7. ステータス

| Phase | 内容 |
|---|---|
| Current | policy-only doc 作成 (本 file)、local-only repo 維持 |
| Origin 化時 | `.github/workflows/ci.yml` を本 policy §3 準拠で起草 |
| 100+ user / 公開時 | public 化判断 (PII pre-flight check 必須) |
