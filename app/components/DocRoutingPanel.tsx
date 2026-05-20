"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import { getCurrentToken } from "@/app/lib/gis";
import { FolderShareSheet } from "@/app/components/FolderShareSheet";
import {
  DOC_TYPE_LABEL,
  createDriveFolder,
  getFolderMeta,
  getRouting,
  updateRouting,
  type DocRouting,
  type DocType,
} from "@/app/lib/doc-routing";

type Props = {
  mainFolderId: string | null;
  mainFolderLabel: string | null;
};

type FolderLabelMap = Partial<Record<DocType, string>>;

const ROW_ORDER: DocType[] = ["receipt", "memo", "business_card", "other"];

const DOC_ICON: Record<DocType, string> = {
  receipt: "📄",
  memo: "📝",
  business_card: "💳",
  other: "📷",
};

export function DocRoutingPanel({ mainFolderId, mainFolderLabel }: Props): JSX.Element {
  const [routing, setRouting] = useState<DocRouting>({});
  const [labels, setLabels] = useState<FolderLabelMap>({});
  const [busy, setBusy] = useState<DocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{ id: string; label: string } | null>(null);

  const refresh = useCallback(async () => {
    const r = await getRouting();
    setRouting(r);
    const tok = await getCurrentToken();
    if (!tok) return;
    const next: FolderLabelMap = {};
    await Promise.all(
      ROW_ORDER.map(async (t) => {
        const id = r[t];
        if (!id) return;
        const meta = await getFolderMeta(id, tok).catch(() => null);
        if (meta) next[t] = meta.name;
      }),
    );
    setLabels(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(t: DocType): Promise<void> {
    setError(null);
    if (!mainFolderId) {
      setError("先にメイン保存先を設定してください");
      return;
    }
    setBusy(t);
    try {
      const tok = await getCurrentToken();
      if (!tok) throw new Error("サインインが切れています");
      const folder = await createDriveFolder({
        name: DOC_TYPE_LABEL[t],
        parent_id: mainFolderId,
        accessToken: tok,
      });
      const next = await updateRouting(t, folder.id);
      setRouting(next);
      setLabels((prev) => ({ ...prev, [t]: folder.name }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleClear(t: DocType): Promise<void> {
    setError(null);
    const next = await updateRouting(t, null);
    setRouting(next);
    setLabels((prev) => {
      const c = { ...prev };
      delete c[t];
      return c;
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-ink-400">
        AI が判別した種類に応じて自動的にサブフォルダへ振り分けます。未設定なら main フォルダ
        {mainFolderLabel ? `「${mainFolderLabel}」` : ""}に残ります。
      </p>
      <div className="overflow-hidden rounded-2xl border border-hairline bg-ink-800/30">
        {ROW_ORDER.map((t, i) => {
          const id = routing[t];
          const name = labels[t];
          const isBusy = busy === t;
          return (
            <div
              key={t}
              className={`flex items-center gap-3 px-4 py-3 ${
                i < ROW_ORDER.length - 1 ? "border-b border-hairline" : ""
              }`}
            >
              <span className="text-[18px]">{DOC_ICON[t]}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium text-ink-100">
                  {DOC_TYPE_LABEL[t]}
                </span>
                <span className="truncate text-[11px] text-ink-400">
                  {id ? <>📁 {name ?? id}</> : "未設定 (main フォルダに残ります)"}
                </span>
              </div>
              {id ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShareTarget({ id, label: name ?? DOC_TYPE_LABEL[t] })}
                    className="inline-flex h-8 items-center rounded-full border border-accent/40 bg-accent/10 px-2.5 text-[11px] font-medium text-accent-soft hover:bg-accent/20"
                  >
                    共有
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleClear(t)}
                    className="inline-flex h-8 items-center rounded-full border border-hairline px-2.5 text-[11px] text-ink-300 hover:text-red-300"
                  >
                    解除
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleCreate(t)}
                  disabled={isBusy || !mainFolderId}
                  className="inline-flex h-8 items-center rounded-full border border-accent/40 bg-accent/10 px-2.5 text-[11px] font-medium text-accent-soft transition hover:bg-accent/20 disabled:opacity-50"
                >
                  {isBusy ? "作成中…" : `📁 ${DOC_TYPE_LABEL[t]} を作成`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error ? (
        <p className="text-[11px] text-red-300/80">{error}</p>
      ) : null}
      <FolderShareSheet
        open={shareTarget !== null}
        folderId={shareTarget?.id ?? null}
        folderLabel={shareTarget?.label ?? null}
        onClose={() => setShareTarget(null)}
      />
    </div>
  );
}
