"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import type { CodexReply } from "@/app/lib/capture-analysis";

type DocType = CodexReply["doc_type"];

const OPTIONS: { type: DocType; label: string; icon: string; tone: string }[] = [
  {
    type: "receipt",
    label: "領収書",
    icon: "📄",
    tone: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  },
  {
    type: "memo",
    label: "メモ",
    icon: "📝",
    tone: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  },
  {
    type: "business_card",
    label: "名刺",
    icon: "💳",
    tone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  },
  {
    type: "other",
    label: "その他",
    icon: "📷",
    tone: "border-hairline bg-ink-800/60 text-ink-300",
  },
];

type Props = {
  value: DocType;
  onChange: (next: DocType) => void | Promise<void>;
};

export function DocTypeChip({ value, onChange }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = OPTIONS.find((o) => o.type === value) ?? OPTIONS[3]!;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium transition hover:brightness-125 ${current.tone}`}
      >
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <span aria-hidden className="ml-0.5 text-[0.5rem] opacity-60">▾</span>
      </button>
      {open ? (
        <ul className="absolute left-0 top-full z-30 mt-1 w-32 overflow-hidden rounded-xl border border-hairline bg-ink-900/95 shadow-card backdrop-blur">
          {OPTIONS.map((o) => (
            <li key={o.type}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (o.type !== value) void onChange(o.type);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[0.75rem] transition hover:bg-white/5 ${
                  o.type === value ? "text-accent-soft" : "text-ink-200"
                }`}
              >
                <span>{o.icon}</span>
                <span>{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
