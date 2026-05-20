"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="glass sticky top-0 z-40 border-b border-hairline">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-[15px] font-semibold tracking-tightest text-ink-50 transition hover:text-white"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-accent shadow-glow"
          />
          Cursorvers Capture
        </Link>
        <Link
          href="/settings"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-ink-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
          aria-label="設定"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.27 16.92l.06-.06A1.7 1.7 0 0 0 4.67 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.67 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.1 4.24l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c0 .67.39 1.27 1 1.51l.05.02H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
