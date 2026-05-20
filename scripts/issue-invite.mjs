#!/usr/bin/env node
// 招待トークン発行 CLI (Masa 用).
//
// 使い方:
//   1. iPhone Safari ではなく Mac の Chrome で capture.cursorvers.jp に
//      サインイン (自分の Google で)
//   2. DevTools → Application → Cookies → "gdrive_email" の値をコピー
//   3. このスクリプトに渡す:
//        node scripts/issue-invite.mjs \
//          --cookie '<gdrive_email cookie value>' \
//          --note "税理士法人 A 配布用" \
//          --max-uses 50 \
//          --expires 2026-08-31
//   4. 出力された URL を税理士法人に送付
//
// 補足: 管理者である自分のメアドが ADMIN_EMAILS env に登録されている必要あり。
//   wrangler pages secret put ADMIN_EMAILS --project-name=cursorvers-capture
//   # 値: masa.stage1@gmail.com,flux@cursorvers.com

const BASE_URL = process.env.CAPTURE_URL ?? "https://capture.cursorvers.jp";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === "--cookie") { out.cookie = v; i++; }
    else if (k === "--note") { out.note = v; i++; }
    else if (k === "--max-uses") { out.max_uses = Number(v); i++; }
    else if (k === "--expires") { out.expires_at = new Date(v).toISOString(); i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
if (!args.cookie) {
  console.error("--cookie <gdrive_email cookie value> が必要です");
  console.error("Mac の Chrome で " + BASE_URL + " にサインイン → DevTools の Cookie からコピー");
  process.exit(1);
}

const body = {};
if (args.note) body.note = args.note;
if (args.max_uses) body.max_uses = args.max_uses;
if (args.expires_at) body.expires_at = args.expires_at;

const res = await fetch(`${BASE_URL}/api/invite/issue`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: `gdrive_email=${encodeURIComponent(args.cookie)}`,
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error("発行失敗:", res.status, await res.text());
  process.exit(2);
}

const data = await res.json();
console.log("");
console.log("✨ 招待トークン発行完了");
console.log("");
console.log("URL (送付用):");
console.log("  " + data.url);
console.log("");
console.log("Token:");
console.log("  " + data.token);
console.log("");
console.log("発行内容:");
console.log("  - max_uses:    " + data.record.max_uses);
console.log("  - expires_at:  " + (data.record.expires_at ?? "無期限"));
console.log("  - note:        " + (data.record.note ?? "(なし)"));
console.log("  - issued_by:   " + data.record.issued_by);
console.log("");
