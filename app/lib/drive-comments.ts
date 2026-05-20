// Drive Comments API wrapper. Operates on files the app created (drive.file
// scope is sufficient). Top-level comments only — replies omitted for now
// since the UI is single-thread.

import { driveFetch } from "./fetch-wrapper";

const FIELDS =
  "id,content,createdTime,modifiedTime,deleted,resolved,author(displayName,photoLink,me)";

export type DriveCommentAuthor = {
  displayName?: string;
  photoLink?: string;
  me?: boolean;
};

export type DriveComment = {
  id: string;
  content: string;
  createdTime: string;
  modifiedTime?: string;
  deleted?: boolean;
  resolved?: boolean;
  author?: DriveCommentAuthor;
};

export async function listComments(fileId: string): Promise<DriveComment[]> {
  const url =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/comments` +
    `?fields=comments(${FIELDS})&pageSize=100&includeDeleted=false`;
  const res = await driveFetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`listComments failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { comments?: DriveComment[] };
  return (data.comments ?? []).filter((c) => !c.deleted);
}

export async function createComment(
  fileId: string,
  content: string,
): Promise<DriveComment> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("コメント内容が空です");
  const url =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/comments` +
    `?fields=${FIELDS}`;
  const res = await driveFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: trimmed }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createComment failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as DriveComment;
}

export async function deleteComment(
  fileId: string,
  commentId: string,
): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/comments/${encodeURIComponent(commentId)}`;
  const res = await driveFetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(`deleteComment failed (${res.status}): ${body.slice(0, 200)}`);
  }
}
