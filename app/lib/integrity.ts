import { sha1Hex } from './hash';

export async function getDriveProperties(blob: Blob): Promise<{ client_sha1: string }> {
  const client_sha1 = await sha1Hex(blob);
  return { client_sha1 };
}
