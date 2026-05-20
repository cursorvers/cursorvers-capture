// Routing config: which Drive folder each doc_type should be moved into.
// Stored in IDB under config:doc_routing. Each entry is optional — unset
// means "leave the file in the main capture folder".
//
// drive.file scope constraint: we can only access files (and folders) the
// app itself created. So the supported folder-pick flow is:
//   - "<main>/<label> を作成"  →  Drive POST that creates the subfolder
//     inside the user's main capture folder. The new folder belongs to
//     the app from then on.
//   - Manual paste of an existing folder id is also allowed but only
//     useful for folders this app previously created.

import { idbGet, idbPut } from "./idb-helpers";

export type DocType = "receipt" | "memo" | "business_card" | "other";

export type DocRouting = Partial<Record<DocType, string>>;

const ROUTING_KEY = "doc_routing";
type RoutingRecord = { key: typeof ROUTING_KEY; value: DocRouting };

export async function getRouting(): Promise<DocRouting> {
  const rec = await idbGet<RoutingRecord>("config", ROUTING_KEY);
  return rec?.value ?? {};
}

export async function setRouting(routing: DocRouting): Promise<void> {
  await idbPut<RoutingRecord>("config", { key: ROUTING_KEY, value: routing });
}

export async function updateRouting(
  doc_type: DocType,
  folder_id: string | null,
): Promise<DocRouting> {
  const current = await getRouting();
  const next: DocRouting = { ...current };
  if (folder_id) {
    next[doc_type] = folder_id;
  } else {
    delete next[doc_type];
  }
  await setRouting(next);
  return next;
}

export function targetFolderFor(
  routing: DocRouting,
  doc_type: DocType,
): string | undefined {
  return routing[doc_type];
}

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  receipt: "領収書",
  memo: "メモ",
  business_card: "名刺",
  other: "その他",
};

// Create a new folder under `parent_id` and return its id+name. drive.file
// scope is sufficient because the new folder is created by this app.
export async function createDriveFolder(opts: {
  name: string;
  parent_id: string;
  accessToken: string;
}): Promise<{ id: string; name: string }> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: opts.name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [opts.parent_id],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createDriveFolder failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id?: string; name?: string };
  if (!data.id || !data.name) {
    throw new Error("createDriveFolder: missing id/name in response");
  }
  return { id: data.id, name: data.name };
}

// Move a file by swapping its parents.
export async function moveDriveFile(opts: {
  file_id: string;
  add_parent: string;
  remove_parent: string;
  accessToken: string;
}): Promise<void> {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(opts.file_id)}`,
  );
  url.searchParams.set("addParents", opts.add_parent);
  url.searchParams.set("removeParents", opts.remove_parent);
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`moveDriveFile failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

// Look up folder metadata by id. drive.file scope only allows this when
// the folder is one we created.
export async function getFolderMeta(
  folder_id: string,
  accessToken: string,
): Promise<{ id: string; name: string } | null> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folder_id)}?fields=id,name,mimeType`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string; name?: string };
  if (!data.id || !data.name) return null;
  return { id: data.id, name: data.name };
}
