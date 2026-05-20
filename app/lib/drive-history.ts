// Drive folder listing for the /history view. The OAuth scope is
// 'drive.file' so we only see files this app created — exactly the
// captures we want listed, nothing more.

import { parseDescription, type CodexReply } from "./capture-analysis";

export type HistoryEntry = {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  thumbnailLink?: string;
  webViewLink?: string;
  description?: string;
  analysis: CodexReply | null;
};

const FIELDS =
  "files(id,name,mimeType,createdTime,thumbnailLink,webViewLink,description)";

export async function listFolderFiles(
  folderId: string,
  accessToken: string,
  pageSize = 50,
): Promise<HistoryEntry[]> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed=false`,
  );
  const url =
    `https://www.googleapis.com/drive/v3/files?q=${q}` +
    `&orderBy=createdTime desc&pageSize=${pageSize}&fields=${encodeURIComponent(FIELDS)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive list failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    files?: Array<{
      id?: string;
      name?: string;
      mimeType?: string;
      createdTime?: string;
      thumbnailLink?: string;
      webViewLink?: string;
      description?: string;
    }>;
  };
  return (data.files ?? [])
    .filter((f) => f.id && f.name)
    .map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType ?? "application/octet-stream",
      createdTime: f.createdTime ?? "",
      thumbnailLink: f.thumbnailLink,
      webViewLink: f.webViewLink,
      description: f.description,
      analysis: parseDescription(f.description),
    }));
}
