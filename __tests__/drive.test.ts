import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initResumableSession, uploadChunk, queryResume, uploadBlob } from '../app/lib/drive';
import * as FetchWrapper from '../app/lib/fetch-wrapper';
import * as Idb from '../app/lib/idb';

// Mock driveFetch
const mockDriveFetch = vi.fn();
vi.spyOn(FetchWrapper, 'driveFetch').mockImplementation(mockDriveFetch);

// Mock idb
const mockIdbGet = vi.fn();
const mockIdbPut = vi.fn();
const mockIdbDelete = vi.fn();

vi.spyOn(Idb.db, 'get').mockImplementation(mockIdbGet);
vi.spyOn(Idb.db, 'put').mockImplementation(mockIdbPut);
vi.spyOn(Idb.db, 'delete').mockImplementation(mockIdbDelete);

describe('drive.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initResumableSession POSTs correct URL+headers, persists sessionUrl in IDB', async () => {
    const mockSessionUrl = 'https://upload.google.com/upload/drive/v3/resumableuploads/session123';
    mockDriveFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        Location: mockSessionUrl,
      }),
    });

    const filename = 'test.jpg';
    const mimeType = 'image/jpeg';
    const folderId = 'folder123';
    const size = 1024;

    const result = await initResumableSession({
      filename, mimeType, folderId, size
    });

    expect(mockDriveFetch).toHaveBeenCalledWith(
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
    expect(result.sessionUrl).toBe(mockSessionUrl);
    expect(typeof result.createdAt).toBe('number');
    expect(mockIdbPut).toHaveBeenCalledWith('uploadSessions', {
      id: filename,
      sessionUrl: mockSessionUrl,
      createdAt: expect.any(Number),
      totalSize: size,
    });
  });

  it('uploadChunk 308 path returns nextStart from Range header', async () => {
    const mockRangeHeader = 'bytes=0-2097151';
    mockDriveFetch.mockResolvedValueOnce({
      status: 308,
      headers: new Headers({
        Range: mockRangeHeader,
      }),
      ok: true,
      statusText: 'Partial Content',
      json: () => Promise.resolve({}),
    });

    const sessionUrl = 'mock-session-url';
    const blob = new Blob([new ArrayBuffer(4 * 1024 * 1024)]); // 4MB blob
    const start = 0;
    const total = blob.size;
    const chunkSize = 2 * 1024 * 1024;

    const result = await uploadChunk(sessionUrl, blob, start, total, chunkSize);

    expect(mockDriveFetch).toHaveBeenCalledWith(sessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${start}-${chunkSize - 1}/${total}`,
      },
      body: blob.slice(start, chunkSize),
    });
    expect(result.done).toBe(false);
    expect(result.nextStart).toBe(2097152);
  });

  it('uploadBlob happy path: init -> upload single chunk (small blob) -> 200 -> returns fileId, IDB session cleared', async () => {
    const mockFileId = 'driveFile123';
    const mockSessionUrl = 'https://upload.google.com/upload/drive/v3/resumableuploads/session123';
    const filename = 'small-test.jpg';
    const folderId = 'folder123';
    const smallBlob = new Blob([new TextEncoder().encode('small file content')]);

    // 1. No existing session in IDB
    mockIdbGet.mockResolvedValueOnce(undefined);

    // 2. initResumableSession call
    mockDriveFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        Location: mockSessionUrl,
      }),
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({}),
    });
    mockIdbPut.mockResolvedValueOnce(undefined); // for initResumableSession

    // 3. uploadChunk call
    mockDriveFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ id: mockFileId }),
      ok: true,
      statusText: 'OK',
    });

    const onProgress = vi.fn();
    const result = await uploadBlob(smallBlob, filename, folderId, onProgress);

    expect(mockIdbGet).toHaveBeenCalledWith('uploadSessions', filename);
    expect(mockDriveFetch).toHaveBeenCalledTimes(2); // init + upload
    expect(mockDriveFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      expect.any(Object)
    );
    expect(mockDriveFetch).toHaveBeenCalledWith(mockSessionUrl, expect.any(Object));

    expect(result.fileId).toBe(mockFileId);
    expect(mockIdbDelete).toHaveBeenCalledWith('uploadSessions', filename);
    expect(onProgress).toHaveBeenCalledWith(smallBlob.size, smallBlob.size);
  });

  it('uploadBlob resumes upload if session exists and is not expired', async () => {
    const mockFileId = 'driveFile456';
    const mockSessionUrl = 'https://upload.google.com/upload/drive/v3/resumableuploads/session456';
    const filename = 'resume-test.jpg';
    const folderId = 'folder123';
    const largeBlob = new Blob([new ArrayBuffer(5 * 1024 * 1024)]); // 5MB blob
    const totalSize = largeBlob.size;
    const resumedStart = 2 * 1024 * 1024; // 2MB already uploaded
    const CHUNK_SIZE = 2 * 1024 * 1024; // Align with drive.ts internal chunk size

    // 1. Existing session in IDB
    mockIdbGet.mockResolvedValueOnce({
      id: filename,
      sessionUrl: mockSessionUrl,
      createdAt: Date.now(), // Not expired
      totalSize: totalSize,
    });

    // 2. queryResume call - returns 308 with nextStart
    mockDriveFetch.mockResolvedValueOnce({
      status: 308,
      headers: new Headers({
        Range: `bytes=0-${resumedStart - 1}`,
      }),
      ok: true,
      statusText: 'Partial Content',
      json: () => Promise.resolve({}),
    });

    // 3. uploadChunk call for the first remaining chunk
    mockDriveFetch.mockResolvedValueOnce({
      status: 308,
      headers: new Headers({
        Range: `bytes=0-${resumedStart + CHUNK_SIZE - 1}`,
      }),
      ok: true,
      statusText: 'Partial Content',
      json: () => Promise.resolve({}),
    });

    // 4. uploadChunk call for the second remaining chunk (finishing it)
    mockDriveFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ id: mockFileId }),
      ok: true,
      statusText: 'OK',
    });

    const onProgress = vi.fn();
    const result = await uploadBlob(largeBlob, filename, folderId, onProgress);

    expect(mockIdbGet).toHaveBeenCalledWith('uploadSessions', filename);
    expect(mockDriveFetch).toHaveBeenCalledTimes(3); // queryResume + 2x uploadChunk

    // Verify queryResume was called correctly
    expect(mockDriveFetch).toHaveBeenCalledWith(mockSessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes */${totalSize}`,
      },
      body: null,
    });

    // Verify first uploadChunk was called from the resumed start
    expect(mockDriveFetch).toHaveBeenCalledWith(mockSessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${resumedStart}-${resumedStart + CHUNK_SIZE - 1}/${totalSize}`,
      },
      body: largeBlob.slice(resumedStart, resumedStart + CHUNK_SIZE),
    });

    // Verify second uploadChunk was called
    const secondChunkStart = resumedStart + CHUNK_SIZE;
    const secondChunkEnd = totalSize - 1;
    expect(mockDriveFetch).toHaveBeenCalledWith(mockSessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${secondChunkStart}-${secondChunkEnd}/${totalSize}`,
      },
      body: largeBlob.slice(secondChunkStart, secondChunkEnd + 1),
    });

    expect(result.fileId).toBe(mockFileId);
    expect(mockIdbDelete).toHaveBeenCalledWith('uploadSessions', filename);
    expect(onProgress).toHaveBeenCalledWith(totalSize, totalSize);
  });

  it('uploadBlob re-initializes session if existing session is expired or queryResume fails', async () => {
    const mockFileId = 'driveFile789';
    const expiredSessionUrl = 'https://upload.google.com/expired/session';
    const newSessionUrl = 'https://upload.google.com/new/session';
    const filename = 'expired-session.jpg';
    const folderId = 'folder123';
    const blob = new Blob([new TextEncoder().encode('file content')]);
    const totalSize = blob.size;

    // 1. Existing EXPIRED session in IDB
    mockIdbGet.mockResolvedValueOnce({
      id: filename,
      sessionUrl: expiredSessionUrl,
      createdAt: Date.now() - (6 * 86400 * 1000 + 1000), // Expired
      totalSize: totalSize,
    });

    // 2. initResumableSession for new session
    mockDriveFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        Location: newSessionUrl,
      }),
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({}),
    });
    mockIdbPut.mockResolvedValueOnce(undefined); // for initResumableSession

    // 3. uploadChunk for the new session
    mockDriveFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ id: mockFileId }),
      ok: true,
      statusText: 'OK',
    });

    const onProgress = vi.fn();
    const result = await uploadBlob(blob, filename, folderId, onProgress);

    expect(mockIdbGet).toHaveBeenCalledWith('uploadSessions', filename);
    expect(mockDriveFetch).toHaveBeenCalledTimes(2); // init + uploadChunk
    expect(mockDriveFetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      expect.any(Object)
    ); // Called for re-init
    expect(mockDriveFetch).toHaveBeenCalledWith(newSessionUrl, expect.any(Object)); // Called with new session URL

    expect(result.fileId).toBe(mockFileId);
    expect(mockIdbDelete).toHaveBeenCalledWith('uploadSessions', filename);
    expect(onProgress).toHaveBeenCalledWith(totalSize, totalSize);
  });

  it('uploadBlob handles 410/404 during uploadChunk by re-initializing and restarting', async () => {
    const mockFileId = 'driveFile010';
    const initialSessionUrl = 'https://upload.google.com/initial/session';
    const reinitSessionUrl = 'https://upload.google.com/reinit/session';
    const filename = '410-restart.jpg';
    const folderId = 'folder123';
    const blob = new Blob([new TextEncoder().encode('short content')]);
    const totalSize = blob.size;

    // 1. No existing session in IDB initially
    mockIdbGet.mockResolvedValueOnce(undefined);

    // 2. First initResumableSession
    mockDriveFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        Location: initialSessionUrl,
      }),
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({}),
    });
    mockIdbPut.mockResolvedValueOnce(undefined);

    // 3. First uploadChunk fails with 410
    mockDriveFetch.mockResolvedValueOnce({
      ok: false,
      status: 410,
      statusText: 'Gone',
      headers: new Headers(),
      json: () => Promise.resolve({}),
    });

    // 4. Second initResumableSession (after 410)
    mockDriveFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        Location: reinitSessionUrl,
      }),
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({}),
    });
    mockIdbPut.mockResolvedValueOnce(undefined);

    // 5. Second uploadChunk succeeds
    mockDriveFetch.mockResolvedValueOnce({
      status: 200,
      json: () => Promise.resolve({ id: mockFileId }),
      ok: true,
      statusText: 'OK',
    });

    const onProgress = vi.fn();
    const result = await uploadBlob(blob, filename, folderId, onProgress);

    expect(mockDriveFetch).toHaveBeenCalledTimes(4); // init1 -> chunk1(fail) -> init2 -> chunk2(success)
    expect(mockIdbDelete).toHaveBeenCalledWith('uploadSessions', filename); // Called after 410 and after success

    // Ensure onProgress was called with 0 after re-init
    expect(onProgress).toHaveBeenCalledWith(0, totalSize);
    expect(onProgress).toHaveBeenCalledWith(totalSize, totalSize);

    expect(result.fileId).toBe(mockFileId);
  });
});
