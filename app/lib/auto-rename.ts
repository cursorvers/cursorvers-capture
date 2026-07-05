import {
  applyExtension,
  type CaptureAnalysis,
} from "@/app/lib/capture-analysis";
import { renameDriveFile } from "@/app/lib/drive";
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

export async function autoApplyAiRename(opts: {
  fileId: string;
  accessToken: string;
  originalDriveName: string;
  analysis: CaptureAnalysis;
}): Promise<AutoRenameResult> {
  const suggested = opts.analysis.suggested_filename.trim();
  if (!suggested) {
    return { driveName: opts.originalDriveName, status: "skipped" };
  }

  const enabled = await getAutoAiRenameEnabled();
  if (!enabled) {
    return { driveName: opts.originalDriveName, status: "disabled" };
  }

  const nextName = applyExtension(suggested, opts.originalDriveName);
  if (nextName === opts.originalDriveName) {
    return { driveName: opts.originalDriveName, status: "skipped" };
  }

  try {
    const updated = await renameDriveFile(opts.fileId, nextName, opts.accessToken);
    return {
      driveName: updated.name,
      originalDriveName: opts.originalDriveName,
      status: "applied",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("auto AI rename failed", error);
    return {
      driveName: opts.originalDriveName,
      originalDriveName: opts.originalDriveName,
      status: "failed",
      error: message,
      isConflict: isConflictError(error),
    };
  }
}
