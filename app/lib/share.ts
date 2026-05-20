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


// ───────────────────────────────────────────────────────────────────
// Link sharing helpers (Phase 9e). "Anyone with link" permissions plus
// readbacks for the share sheet UI.
// ───────────────────────────────────────────────────────────────────

export type SharePermission = {
  id: string;
  type: "user" | "group" | "domain" | "anyone";
  role: "reader" | "commenter" | "writer" | "owner";
  emailAddress?: string;
  displayName?: string;
};

export async function listPermissions(
  driveId: string,
): Promise<SharePermission[]> {
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${driveId}/permissions?fields=permissions(id,type,role,emailAddress,displayName)&pageSize=100`,
    { method: "GET" },
  );
  if (!response.ok) {
    throw new Error(`listPermissions failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { permissions?: SharePermission[] };
  return data.permissions ?? [];
}

export async function enableLinkSharing(
  driveId: string,
  role: "reader" | "commenter" = "reader",
): Promise<{ permissionId: string; webViewLink: string }> {
  // 1. Add "anyone with link" permission. If one already exists, Drive
  //    returns 400 — we suppress and fall through to fetching the link.
  let permissionId: string | null = null;
  const permRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${driveId}/permissions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "anyone", role, allowFileDiscovery: false }),
    },
  );
  if (permRes.ok) {
    const data = (await permRes.json()) as DrivePermissionApiResponse;
    permissionId = data.id;
  } else if (permRes.status === 400 || permRes.status === 409) {
    // Already-shared — find the existing anyone permission.
    const list = await listPermissions(driveId);
    permissionId = list.find((p) => p.type === "anyone")?.id ?? null;
  } else {
    const body = await permRes.text();
    throw new Error(`enableLinkSharing failed (${permRes.status}): ${body.slice(0, 200)}`);
  }

  // 2. Fetch the webViewLink so the UI can show a Copy button.
  const link = await fetchWebViewLink(driveId);
  if (!permissionId) {
    throw new Error("enableLinkSharing: missing permission id after grant");
  }
  return { permissionId, webViewLink: link };
}

export async function disableLinkSharing(driveId: string): Promise<void> {
  const list = await listPermissions(driveId);
  const anyonePerms = list.filter((p) => p.type === "anyone");
  await Promise.all(
    anyonePerms.map((p) =>
      driveFetch(`https://www.googleapis.com/drive/v3/files/${driveId}/permissions/${p.id}`, {
        method: "DELETE",
      }),
    ),
  );
}

export async function fetchWebViewLink(driveId: string): Promise<string> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${driveId}?fields=webViewLink`,
    { method: "GET" },
  );
  if (!res.ok) {
    throw new Error(`fetchWebViewLink failed: ${res.status}`);
  }
  const data = (await res.json()) as { webViewLink?: string };
  if (!data.webViewLink) {
    throw new Error("fetchWebViewLink: response missing webViewLink");
  }
  return data.webViewLink;
}
