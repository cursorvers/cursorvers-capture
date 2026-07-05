"use client";

import { useEffect, useRef, useState, type JSX } from "react";

type Props = {
  label: string;
  value: string;          // display value (already formatted)
  placeholder?: string;
  inputType?: "text" | "number" | "date";
  ariaLabel: string;
  toneClass?: string;     // tailwind classes for chip background + border
  onCommit: (next: string) => void | Promise<void>;
};

export function EditableChip({
  label,
  value,
  placeholder,
  inputType = "text",
  ariaLabel,
  toneClass = "border-hairline bg-ink-800/60 text-ink-100",
  onCommit,
}: Props): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit(): Promise<void> {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onCommit(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel(): void {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] ${toneClass}`}>
        <span>{label}</span>
        <input
          ref={inputRef}
          type={inputType}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") cancel();
          }}
          onBlur={() => void commit()}
          aria-label={ariaLabel}
          inputMode={inputType === "number" ? "decimal" : undefined}
          className="w-24 bg-transparent text-[0.6875rem] text-current outline-none"
          disabled={saving}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`${ariaLabel} を編集`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] transition hover:brightness-125 ${toneClass}`}
    >
      <span>{label}</span>
      <span>{value || (placeholder ?? "—")}</span>
    </button>
  );
}
