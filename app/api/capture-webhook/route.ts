import { NextResponse } from 'next/server';
import { kvSet } from '../../../app/lib/kv';
import { dispatchToCodex, type CaptureWebhookPayload, type CodexChatbackResult } from '../../../app/lib/codex-app-server';


const CHATBACK_KV_TTL_SEC = 60 * 60 * 24; // 24 hours

export async function POST(req: Request) {
  // Authentication: Verify Authorization header
  const authorizationHeader = req.headers.get('Authorization');
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return new NextResponse('Unauthorized: Missing or invalid Authorization header', { status: 401 });
  }

  const token = authorizationHeader.split(' ')[1];
  // For S7, we will use a simplified check. In S11, this should be a more robust JWT validation.
  // For now, let's assume the token is a simple pre-shared key or can be validated against server-cookie's HMAC logic.
  // For this slice, we will skip full JWT validation and assume a valid token means authenticated.
  // If `server-cookie.ts` has a verifySignature, we can use that for basic HMAC if applicable to Bearer token.
  // Assuming `verifySignature` from `server-cookie.ts` could be adapted, for now, a placeholder logic.
  const isAuthorized = process.env.WEBHOOK_SECRET === token; // Placeholder for now, replace with proper JWT/HMAC check in S11

  if (!isAuthorized) {
    // In a real scenario, `verifySignature` would take the token and check it.
    // const isValid = await verifySignature(token, 'some-expected-data'); // Example usage
    return new NextResponse('Unauthorized: Invalid token', { status: 401 });
  }

  let payload: CaptureWebhookPayload;
  try {
    payload = (await req.json()) as CaptureWebhookPayload;
    // Basic validation of payload
    if (!payload.drive_file_id || !payload.filename || !payload.mime || !payload.size || !payload.shot_at || !payload.sha1) {
      return new NextResponse('Bad Request: Missing required payload fields', { status: 400 });
    }
    if (payload.mime !== 'image/jpeg') {
      return new NextResponse('Bad Request: Only image/jpeg mime type is supported', { status: 400 });
    }
  } catch (error) {
    console.error('Failed to parse webhook payload:', error);
    return new NextResponse('Bad Request: Invalid JSON payload', { status: 400 });
  }

  const kvKey = `chatback:${payload.drive_file_id}`;

  // Store initial pending state in KV
  await kvSet(kvKey, { status: 'pending', ...payload }, CHATBACK_KV_TTL_SEC);

  // Dispatch to Codex App Server asynchronously
  // We don't await this to ensure the webhook returns quickly.
  dispatchToCodex(payload)
    .then(async (codexResult: CodexChatbackResult) => {
      await kvSet(kvKey, { status: 'done', result: codexResult }, CHATBACK_KV_TTL_SEC);
    })
    .catch(async (error) => {
      console.error(`Error dispatching to Codex for ${payload.drive_file_id}:`, error);
      // Store failure status in KV
      await kvSet(kvKey, { status: 'failed', error: error.message }, CHATBACK_KV_TTL_SEC);
    });

  return new NextResponse('Accepted', { status: 202 });
}
