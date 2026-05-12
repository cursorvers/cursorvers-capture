export async function sha1Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  const byteArray = Array.from(new Uint8Array(hashBuffer));
  return byteArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha1Short(blob: Blob): Promise<string> {
  const fullHash = await sha1Hex(blob);
  return fullHash.substring(0, 8);
}
