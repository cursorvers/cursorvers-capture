import { db } from './idb';
import { revokeShare } from './share';

export interface ShareRecord {
  id: string; // Unique ID for the share record
  driveFileId: string;
  email: string;
  permissionId: string;
  sharedAt: number;
  filename?: string; // Optional: to be displayed in history list
}

export async function recordShare(
  driveFileId: string,
  email: string,
  permissionId: string,
  filename?: string
): Promise<void> {
  const id = `${driveFileId}-${permissionId}` // Unique ID for the record
  await db.put<ShareRecord>('shareHistory', {
    id,
    driveFileId,
    email,
    permissionId,
    sharedAt: Date.now(),
    filename,
  });
}

export async function getShareHistory(limit = 20): Promise<ShareRecord[]> {
  const allShares = await db.all<ShareRecord>('shareHistory');
  // Sort by sharedAt in descending order (most recent first) and take the limit
  return allShares.sort((a, b) => b.sharedAt - a.sharedAt).slice(0, limit);
}

export async function revokeFromHistory(
  driveFileId: string,
  permissionId: string
): Promise<void> {
  await revokeShare(driveFileId, permissionId);
  const recordId = `${driveFileId}-${permissionId}`
  await db.delete('shareHistory', recordId);
}
