import {
  getCapture,
  listAllCaptures,
  putCapture,
  type CaptureRecord,
} from "./captures-db";
import { ensureRoutingFolder, moveDriveFile, type DocType } from "./doc-routing";

const inFlightFileIds = new Set<string>();

export type RetargetCaptureResult = {
  record: CaptureRecord;
  undo: RetargetUndo;
};

export type RetargetUndo = {
  file_id: string;
  previous_doc_type: DocType;
  previous_parent_id: string;
  previous_routed_to?: string;
  current_doc_type: DocType;
  current_parent_id: string;
};

export type UndoRetargetCaptureResult = CaptureRecord & {
  idbUpdateFailed?: boolean;
};

export type BackfillProgress = {
  done: number;
  total: number;
  success: number;
  skipped: number;
  failed: number;
};

export type BackfillResult = BackfillProgress;

async function withFileRoutingLock<T>(
  file_id: string,
  callback: () => Promise<T>,
): Promise<T> {
  if (inFlightFileIds.has(file_id)) {
    throw new Error("このファイルは振り分け処理中です。少し待ってから再試行してください。");
  }
  inFlightFileIds.add(file_id);
  try {
    return await callback();
  } finally {
    inFlightFileIds.delete(file_id);
  }
}

export function isCaptureRoutingInFlight(file_id: string): boolean {
  return inFlightFileIds.has(file_id);
}

async function putCaptureWithCompensationRetry(record: CaptureRecord): Promise<void> {
  try {
    await putCapture(record);
  } catch {
    await putCapture(record);
  }
}

function hasKnownDocType(value: unknown): value is DocType {
  return (
    value === "receipt" ||
    value === "memo" ||
    value === "business_card" ||
    value === "other"
  );
}

export async function retargetCaptureDocType(opts: {
  file_id: string;
  doc_type: DocType;
  mainFolderId: string;
  accessToken: string;
}): Promise<RetargetCaptureResult> {
  return withFileRoutingLock(opts.file_id, async () => {
    const current = await getCapture(opts.file_id);
    if (!current) {
      throw new Error("この撮影記録が端末内に見つかりません。履歴を更新してから再試行してください。");
    }
    if (!current.parent_id) {
      throw new Error("現在の保存先が不明なため、振り分け先を変更できません。");
    }

    const target = await ensureRoutingFolder({
      doc_type: opts.doc_type,
      parent_id: opts.mainFolderId,
      accessToken: opts.accessToken,
    });
    const previousParent = current.parent_id;
    const previousDocType = current.doc_type;
    const previousRoutedTo = current.routed_to;
    const moved = previousParent !== target;

    if (moved) {
      await moveDriveFile({
        file_id: opts.file_id,
        add_parent: target,
        remove_parent: previousParent,
        accessToken: opts.accessToken,
      });
    }

    const next: CaptureRecord = {
      ...current,
      doc_type: opts.doc_type,
      parent_id: target,
      routed_to: target,
      routed_at: new Date().toISOString(),
    };
    try {
      await putCaptureWithCompensationRetry(next);
    } catch (err) {
      if (moved) {
        await moveDriveFile({
          file_id: opts.file_id,
          add_parent: previousParent,
          remove_parent: target,
          accessToken: opts.accessToken,
        }).catch((rollbackErr) => {
          console.error("routing rollback failed", rollbackErr);
        });
      }
      await putCaptureWithCompensationRetry(current).catch((restoreErr) => {
        console.error("capture restore after routing failure failed", restoreErr);
      });
      throw err;
    }

    return {
      record: next,
      undo: {
        file_id: opts.file_id,
        previous_doc_type: previousDocType,
        previous_parent_id: previousParent,
        previous_routed_to: previousRoutedTo,
        current_doc_type: opts.doc_type,
        current_parent_id: target,
      },
    };
  });
}

export async function undoRetargetCaptureDocType(opts: {
  undo: RetargetUndo;
  accessToken: string;
}): Promise<UndoRetargetCaptureResult> {
  return withFileRoutingLock(opts.undo.file_id, async () => {
    const current = await getCapture(opts.undo.file_id);
    if (!current) {
      throw new Error("この撮影記録が端末内に見つかりません。");
    }

    if (opts.undo.current_parent_id !== opts.undo.previous_parent_id) {
      await moveDriveFile({
        file_id: opts.undo.file_id,
        add_parent: opts.undo.previous_parent_id,
        remove_parent: opts.undo.current_parent_id,
        accessToken: opts.accessToken,
      });
    }

    const restored: CaptureRecord = {
      ...current,
      doc_type: opts.undo.previous_doc_type,
      parent_id: opts.undo.previous_parent_id,
      routed_to: opts.undo.previous_routed_to,
      routed_at: opts.undo.previous_routed_to ? new Date().toISOString() : undefined,
    };
    try {
      await putCaptureWithCompensationRetry(restored);
    } catch (err) {
      console.error("capture restore after undo routing failed", err);
      return { ...restored, idbUpdateFailed: true };
    }
    return restored;
  });
}

export async function backfillUnroutedCaptures(opts: {
  mainFolderId: string;
  accessToken: string;
  onProgress?: (progress: BackfillProgress) => void;
}): Promise<BackfillResult> {
  const all = await listAllCaptures();
  const candidates = all.filter(
    (record) => !record.routed_to || record.parent_id === opts.mainFolderId,
  );
  const progress: BackfillProgress = {
    done: 0,
    total: candidates.length,
    success: 0,
    skipped: 0,
    failed: 0,
  };
  opts.onProgress?.({ ...progress });

  for (const record of candidates) {
    try {
      await withFileRoutingLock(record.file_id, async () => {
        if (!hasKnownDocType(record.doc_type)) {
          progress.skipped += 1;
          return;
        }
        const target = await ensureRoutingFolder({
          doc_type: record.doc_type,
          parent_id: opts.mainFolderId,
          accessToken: opts.accessToken,
        });
        if (record.routed_to && record.parent_id === target) {
          progress.skipped += 1;
          return;
        }
        if (record.parent_id === target) {
          const next: CaptureRecord = {
            ...record,
            routed_to: target,
            routed_at: record.routed_at ?? new Date().toISOString(),
          };
          await putCaptureWithCompensationRetry(next);
          progress.skipped += 1;
          return;
        }

        const removeParent = record.parent_id ?? opts.mainFolderId;
        await moveDriveFile({
          file_id: record.file_id,
          add_parent: target,
          remove_parent: removeParent,
          accessToken: opts.accessToken,
        });
        const next: CaptureRecord = {
          ...record,
          parent_id: target,
          routed_to: target,
          routed_at: new Date().toISOString(),
        };
        await putCaptureWithCompensationRetry(next);
        progress.success += 1;
      });
    } catch (err) {
      console.error("backfill routing failed", record.file_id, err);
      progress.failed += 1;
    } finally {
      progress.done += 1;
      opts.onProgress?.({ ...progress });
    }
  }

  return progress;
}
