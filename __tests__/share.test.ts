import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shareWithEmail, revokeShare, shareFolderWithEmail } from '../app/lib/share';

// Mock driveFetch
vi.mock('../app/lib/fetch-wrapper', () => ({
  driveFetch: vi.fn(),
}));

import { driveFetch } from '../app/lib/fetch-wrapper';

describe('share', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('shareWithEmail', () => {
    it('should call Drive API with correct URL, method, headers, and body for file sharing', async () => {
      const mockPermissionId = 'mockPermissionId123';
      (driveFetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: mockPermissionId }),
        statusText: 'OK',
      });

      const driveFileId = 'file123';
      const email = 'test@example.com';
      const role = 'reader';

      const result = await shareWithEmail(driveFileId, email, role);

      expect(driveFetch).toHaveBeenCalledTimes(1);
      expect(driveFetch).toHaveBeenCalledWith(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions?sendNotificationEmail=false`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'user',
            role,
            emailAddress: email,
          }),
        }
      );
      expect(result).toEqual({ permissionId: mockPermissionId });
    });

    it('should throw an error if API call fails', async () => {
      (driveFetch as vi.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: { message: 'Invalid email' } }),
      });

      const driveFileId = 'file123';
      const email = 'invalid-email';

      await expect(shareWithEmail(driveFileId, email)).rejects.toThrow(
        'Failed to share file: Bad Request - Invalid email'
      );
    });
  });

  describe('revokeShare', () => {
    it('should call Drive API with correct URL and method for revoking share', async () => {
      (driveFetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: 'No Content',
      });

      const driveFileId = 'file123';
      const permissionId = 'perm456';

      await revokeShare(driveFileId, permissionId);

      expect(driveFetch).toHaveBeenCalledTimes(1);
      expect(driveFetch).toHaveBeenCalledWith(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions/${permissionId}`,
        {
          method: 'DELETE',
        }
      );
    });

    it('should throw an error if API call fails', async () => {
      (driveFetch as vi.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: { message: 'Permission not found' } }),
      });

      const driveFileId = 'file123';
      const permissionId = 'nonExistentPerm';

      await expect(revokeShare(driveFileId, permissionId)).rejects.toThrow(
        'Failed to revoke share: Not Found - Permission not found'
      );
    });
  });

  describe('shareFolderWithEmail', () => {
    it('should call Drive API with correct URL, method, headers, and body for folder sharing', async () => {
      const mockPermissionId = 'mockPermissionIdFolder';
      (driveFetch as vi.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: mockPermissionId }),
        statusText: 'OK',
      });

      const folderId = 'folder789';
      const email = 'folderuser@example.com';
      const role = 'reader';

      const result = await shareFolderWithEmail(folderId, email, role);

      expect(driveFetch).toHaveBeenCalledTimes(1);
      expect(driveFetch).toHaveBeenCalledWith(
        `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?sendNotificationEmail=false`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'user',
            role,
            emailAddress: email,
          }),
        }
      );
      expect(result).toEqual({ permissionId: mockPermissionId });
    });

    it('should throw an error if folder sharing API call fails', async () => {
      (driveFetch as vi.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: { message: 'User not authorized' } }),
      });

      const folderId = 'folder789';
      const email = 'unauthorized@example.com';

      await expect(shareFolderWithEmail(folderId, email)).rejects.toThrow(
        'Failed to share folder: Forbidden - User not authorized'
      );
    });
  });
});
