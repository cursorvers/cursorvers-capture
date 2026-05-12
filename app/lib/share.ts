import { driveFetch } from './fetch-wrapper';

interface DrivePermissionApiResponse {
  id: string;
}

interface PermissionResponse {
  permissionId: string;
}
export async function shareWithEmail(
  driveFileId: string,
  email: string,
  role: 'reader' | 'commenter' = 'reader'
): Promise<PermissionResponse> {
  const response = await driveFetch(
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to share file: ${response.statusText} - ${errorData.error.message}`);
    }
  
    const data: DrivePermissionApiResponse = await response.json();
    return { permissionId: data.id };
}

export async function revokeShare(
  driveFileId: string,
  permissionId: string
): Promise<void> {
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions/${permissionId}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to revoke share: ${response.statusText} - ${errorData.error.message}`);
  }
}

export async function shareFolderWithEmail(
  folderId: string,
  email: string,
  role: 'reader' | 'commenter' = 'reader'
): Promise<PermissionResponse> {
  const response = await driveFetch(
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

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to share folder: ${response.statusText} - ${errorData.error.message}`);
  }

  const data: DrivePermissionApiResponse = await response.json();
  return { permissionId: data.id };
}
