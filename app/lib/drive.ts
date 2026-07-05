import { driveFetch } from './fetch-wrapper';
import { db } from './idb';

const UPLOAD_SESSION_EXPIRATION_MS = 6 * 86400 * 1000; // 6 days

interface ResumableSession {
  id: string;
  sessionUrl: string;
  createdAt: number;
  totalSize: number;
}

function createUploadSessionKey(filename: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${filename}:${Date.now()}:${random}`;
}

export async function initResumableSession(opts: {
  filename: string;
  mimeType: 'image/jpeg';
  folderId: string;
  size: number;
  sessionId?: string;
}): Promise<{ sessionUrl: string; createdAt: number }> {
  const { filename, mimeType, folderId, size, sessionId = filename } = opts;
  const response = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': size.toString(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: filename,
        parents: [folderId],
        mimeType: mimeType,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to initiate resumable session: ${response.statusText}`);
  }

  const sessionUrl = response.headers.get('Location');
  if (!sessionUrl) {
    throw new Error('No Location header found in resumable session initiation response.');
  }

  const createdAt = Date.now();
  await db.put('uploadSessions', {
    id: sessionId,
    sessionUrl,
    createdAt,
    totalSize: size,
  });

  return { sessionUrl, createdAt };
}

// Structured upload error categories
export class DriveUploadError extends Error {
  constructor(
    message: string,
    public category: "auth_expired" | "forbidden" | "session_expired" | "rate_limited" | "server_error" | "unknown",
    public status: number,
  ) {
    super(message);
    this.name = "DriveUploadError";
  }
}

export async function uploadChunk(
  sessionUrl: string,
  blob: Blob,
  start: number,
  total: number,
  chunkSize: number = 2 * 1024 * 1024
): Promise<{ done: boolean; nextStart?: number; fileId?: string }> {
  const end = Math.min(start + chunkSize - 1, total - 1);
  const chunk = blob.slice(start, end + 1);

  const response = await driveFetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Range': `bytes ${start}-${end}/${total}`,
    },
    body: chunk,
  });

  if (response.status === 200 || response.status === 201) {
    const data = await response.json();
    return { done: true, fileId: data.id };
  }
  if (response.status === 308) {
    const rangeHeader = response.headers.get('Range');
    if (rangeHeader) {
      const m = rangeHeader.match(/bytes=0-(\d+)/);
      if (m) return { done: false, nextStart: parseInt(m[1], 10) + 1 };
    }
    return { done: false, nextStart: start + chunk.size };
  }
  // Structured error categorization
  const status = response.status;
  if (status === 401) {
    throw new DriveUploadError("認証が切れました。再認可してください", "auth_expired", status);
  }
  if (status === 403) {
    throw new DriveUploadError("Drive 側で拒否されました (権限・容量・スコープ等)", "forbidden", status);
  }
  if (status === 404 || status === 410) {
    throw new DriveUploadError("アップロード セッションが失効しました。新しい撮影として再アップロードしてください", "session_expired", status);
  }
  if (status === 429) {
    throw new DriveUploadError("Drive API のレート制限に達しました。しばらく待ってから再試行してください", "rate_limited", status);
  }
  if (status >= 500 && status < 600) {
    throw new DriveUploadError("Drive 側の一時的な障害です。再試行してください", "server_error", status);
  }
  throw new DriveUploadError(`予期しない応答 (status ${status})`, "unknown", status);
}

export async function queryResume(
  sessionUrl: string,
  total: number
): Promise<{ done: boolean; nextStart?: number; fileId?: string }> {
  const response = await driveFetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Range': `bytes */${total}`,
    },
    body: null, // Empty body for queryResume
  });

  if (response.status === 200 || response.status === 201) {
    const data = await response.json();
    return { done: true, fileId: data.id };
  } else if (response.status === 308) {
    const rangeHeader = response.headers.get('Range');
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d+)/);
      if (match && match[2]) {
        return { done: false, nextStart: parseInt(match[2], 10) + 1 };
      }
    }
    return { done: false, nextStart: 0 }; // Should return nextStart, default to 0 if not found
  } else if (response.status >= 400) {
    throw new Error(`Query resume failed: ${response.statusText}`);
  }

  throw new Error(`Unexpected query resume response status: ${response.status}`);
}

export async function uploadBlob(

  blob: Blob,

  filename: string,

  folderId: string,

  onProgress?: (bytesUploaded: number, total: number) => void,

  opts?: { sessionId?: string }

): Promise<{ fileId: string }> {

  const sessionId = opts?.sessionId ?? createUploadSessionKey(filename);

  const initialSession: ResumableSession | undefined = await db.get('uploadSessions', sessionId);

    let sessionUrl: string = ''; // Will be assigned definitively before the loop

    let currentOffset = 0;

    const totalSize = blob.size;

    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB



  let shouldReinitialize = false;



  if (initialSession && initialSession.createdAt > Date.now() - UPLOAD_SESSION_EXPIRATION_MS) {

    sessionUrl = initialSession.sessionUrl; // Assign from existing valid session

    try {

      const resumeStatus = await queryResume(sessionUrl, totalSize);

      if (resumeStatus.done) {

        await db.delete('uploadSessions', sessionId);

        onProgress?.(totalSize, totalSize);

        return { fileId: resumeStatus.fileId! };

      }

      currentOffset = resumeStatus.nextStart || 0;

    } catch {

      // If queryResume fails (e.g., 404/410), treat as no valid session, force re-initialization

      shouldReinitialize = true;

    }

  } else {

    // No valid existing session found (either none, or expired)

    shouldReinitialize = true;

  }



  if (shouldReinitialize) {

    // If we reach here, either no valid session was found, or queryResume failed.

    // Ensure existing (potentially expired/invalid) session is cleared before re-initializing.

    if (initialSession) {

      await db.delete('uploadSessions', sessionId);

    }

    const newSession = await initResumableSession({

      filename,

      mimeType: 'image/jpeg',

      folderId,

      size: totalSize,

      sessionId,

    });

    sessionUrl = newSession.sessionUrl;

    currentOffset = 0; // Start fresh from the beginning

  }



  // At this point, sessionUrl is guaranteed to be assigned.



  while (currentOffset < totalSize) {

    try {

      const uploadResult = await uploadChunk(sessionUrl, blob, currentOffset, totalSize, CHUNK_SIZE);

      if (uploadResult.done) {

        await db.delete('uploadSessions', sessionId);

        onProgress?.(totalSize, totalSize);

        return { fileId: uploadResult.fileId! };

      }

      currentOffset = uploadResult.nextStart || currentOffset + CHUNK_SIZE;

      onProgress?.(currentOffset, totalSize);

    } catch (error: unknown) {

      if (
        error instanceof DriveUploadError &&
        error.category === "session_expired"
      ) {

        // Session expired or not found during chunk upload, re-initialize once

        await db.delete('uploadSessions', sessionId);

        const newSession = await initResumableSession({

          filename,

          mimeType: 'image/jpeg',

          folderId,

          size: totalSize,

          sessionId,

        });

        sessionUrl = newSession.sessionUrl;

        currentOffset = 0; // Restart upload from the beginning with new session

        onProgress?.(0, totalSize); // Reset progress

      } else {

        throw error; // Re-throw for other unrecoverable errors

      }

    }

  }



  throw new Error('Upload did not complete.');

}

export async function updateMetadata(
  driveFileId: string,
  properties: Record<string, string | undefined>
): Promise<void> {
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,appProperties`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appProperties: properties }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to update Drive file metadata: ${response.statusText}`
    );
  }
}

// Drive ファイル名を変更する (drive.file scope で書込可)。
export async function renameDriveFile(
  fileId: string,
  newName: string,
  accessToken: string,
): Promise<{ id: string; name: string }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Drive rename failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }
  const data = (await res.json()) as { id?: string; name?: string };
  if (!data.id || !data.name) {
    throw new Error("Drive rename returned no id/name");
  }
  return { id: data.id, name: data.name };
}
