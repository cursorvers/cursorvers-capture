import { driveFetch } from "./fetch-wrapper";

export type DriveFile = {
  id: string;
  name: string;
  createdTime?: string;
  size?: string;
  appProperties?: Record<string, string>;
};

export type MonthlyStats = {
  yearMonth: string;
  count: number;
  totalBytes: number;
};

/** Escape single quotes and backslashes for Drive API `q` string literals. */
export function escapeDriveQuerySegment(folderId: string): string {
  return folderId.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const escaped = escapeDriveQuerySegment(folderId);
  const q = `'${escaped}' in parents and trashed=false`;
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q,
      fields: "nextPageToken,files(id,name,createdTime,size,appProperties)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
    const res = await driveFetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Drive files.list failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      nextPageToken?: string;
      files?: DriveFile[];
    };

    if (data.files?.length) {
      files.push(...data.files);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

export function aggregateMonthlyStats(
  files: DriveFile[],
  months: number,
): MonthlyStats[] {
  const now = new Date();
  const keys: string[] = [];

  for (let i = 0; i < months; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    keys.unshift(ym);
  }

  const buckets = new Map<string, { count: number; totalBytes: number }>();
  for (const k of keys) {
    buckets.set(k, { count: 0, totalBytes: 0 });
  }

  for (const f of files) {
    if (!f.createdTime) {
      continue;
    }
    const d = new Date(f.createdTime);
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(ym);
    if (!b) {
      continue;
    }
    b.count += 1;
    b.totalBytes += Number(f.size ?? 0);
  }

  return keys.map((yearMonth) => ({
    yearMonth,
    count: buckets.get(yearMonth)!.count,
    totalBytes: buckets.get(yearMonth)!.totalBytes,
  }));
}

export function summarizeCurrentMonth(files: DriveFile[]): {
  count: number;
  totalBytes: number;
} {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let count = 0;
  let totalBytes = 0;

  for (const f of files) {
    if (!f.createdTime) {
      continue;
    }
    const d = new Date(f.createdTime);
    const fym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (fym !== ym) {
      continue;
    }
    count += 1;
    totalBytes += Number(f.size ?? 0);
  }

  return { count, totalBytes };
}

export function filterFilesByKeyword(files: DriveFile[], keyword: string): DriveFile[] {
  const k = keyword.trim().toLowerCase();
  if (!k) {
    return files;
  }
  return files.filter((f) => {
    if (f.name.toLowerCase().includes(k)) {
      return true;
    }
    if (f.appProperties) {
      const haystack = Object.entries(f.appProperties)
        .map(([key, val]) => `${key} ${val}`)
        .join(" ")
        .toLowerCase();
      if (haystack.includes(k)) {
        return true;
      }
    }
    return false;
  });
}

export async function getMonthlyStats(
  folderId: string,
  months = 6,
): Promise<MonthlyStats[]> {
  const files = await listFolderFiles(folderId);
  return aggregateMonthlyStats(files, months);
}

export async function searchByKeyword(
  folderId: string,
  keyword: string,
): Promise<DriveFile[]> {
  const files = await listFolderFiles(folderId);
  return filterFilesByKeyword(files, keyword);
}
