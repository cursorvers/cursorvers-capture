import {
  applyExtension,
  type CaptureAnalysis,
} from "@/app/lib/capture-analysis";
import { getDriveFileName, renameDriveFile } from "@/app/lib/drive";
import { getAutoAiRenameEnabled } from "@/app/lib/ai-rename-toggle";

export type AutoRenameResult = {
  driveName: string;
  originalDriveName?: string;
  status: "applied" | "disabled" | "skipped" | "failed";
  error?: string;
  isConflict?: boolean;
};

function isConflictError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("(409)");
}

function result(opts: {
  driveName: string;
  originalDriveName: string;
  status: AutoRenameResult["status"];
  error?: string;
  isConflict?: boolean;
}): AutoRenameResult {
  return {
    driveName: opts.driveName,
    originalDriveName: opts.originalDriveName,
    status: opts.status,
    error: opts.error,
    isConflict: opts.isConflict,
  };
}

export async function autoApplyAiRename(opts: {
  fileId: string;
  accessToken: string;
  originalDriveName: string;
  analysis: CaptureAnalysis;
}): Promise<AutoRenameResult> {
  const suggested = opts.analysis.suggested_filename.trim();
  if (!suggested) {
    return result({
      driveName: opts.originalDriveName,
      originalDriveName: opts.originalDriveName,
      status: "skipped",
    });
  }

  const enabled = await getAutoAiRenameEnabled();
  if (!enabled) {
    return result({
      driveName: opts.originalDriveName,
      originalDriveName: opts.originalDriveName,
      status: "disabled",
    });
  }

  const nextName = applyExtension(suggested, opts.originalDriveName);
  if (nextName === opts.originalDriveName) {
    return result({
      driveName: opts.originalDriveName,
      originalDriveName: opts.originalDriveName,
      status: "skipped",
    });
  }

  try {
    const currentName = await getDriveFileName(opts.fileId, opts.accessToken);
    if (currentName !== opts.originalDriveName) {
      return result({
        driveName: currentName,
        originalDriveName: opts.originalDriveName,
        status: "skipped",
      });
    }

    const updated = await renameDriveFile(opts.fileId, nextName, opts.accessToken);
    return result({
      driveName: updated.name,
      originalDriveName: opts.originalDriveName,
      status: "applied",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("auto AI rename failed", error);
    return result({
      driveName: opts.originalDriveName,
      originalDriveName: opts.originalDriveName,
      status: "failed",
      error: message,
      isConflict: isConflictError(error),
    });
  }
}
