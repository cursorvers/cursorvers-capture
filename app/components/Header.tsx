"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function BrandMark(): JSX.Element {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className="h-5 w-5 shrink-0"
    >
      <ellipse
        cx="32" cy="36" rx="22" ry="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        transform="rotate(-18 32 36)"
        opacity="0.7"
      />
      <path
        d="M27 18 L44 30 L36 31 L34 41 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="27" cy="18" r="2.5" fill="#fff"/>
    </svg>
  );
}

function BackArrow(): JSX.Element {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 12L6 8l4-4" />
    </svg>
  );
}

function GearIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.27 16.92l.06-.06A1.7 1.7 0 0 0 4.67 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.67 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.1 4.24l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c0 .67.39 1.27 1 1.51l.05.02H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname() ?? "/";
  const isHome = pathname === "/";
  const isSettings = pathname.startsWith("/settings");

  return (
    <header className="glass sticky top-0 z-40 border-b border-hairline">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
        {isHome ? (
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-[15px] font-semibold tracking-tightest text-ink-50 transition hover:text-white"
          >
            <BrandMark />
            <span>Cursorvers</span>
            <span aria-hidden className="text-ink-400">·</span>
            <span className="font-medium text-ink-200">Capture</span>
          </Link>
        ) : (
          <Link
            href="/"
            aria-label="ホームへ戻る"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline bg-ink-900/50 pl-2.5 pr-3.5 text-[13px] font-medium text-ink-200 transition active:scale-[0.97] hover:border-white/20 hover:bg-ink-900 hover:text-white"
          >
            <BackArrow />
            <span>ホーム</span>
          </Link>
        )}

        <Link
          href="/history"
          aria-label="履歴"
          className="inline-flex h-10 items-center gap-1 rounded-full border border-hairline bg-ink-900/50 px-3 text-[12px] font-medium text-ink-200 transition active:scale-[0.97] hover:border-white/20 hover:bg-ink-900 hover:text-white"
        >
          履歴
        </Link>

        <Link
          href="/settings"
          aria-label="設定"
          aria-current={isSettings ? "page" : undefined}
          className={
            isSettings
              ? "inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent-soft transition hover:bg-accent/15"
              : "inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-ink-300 transition active:scale-[0.97] hover:border-white/20 hover:bg-white/5 hover:text-white"
          }
        >
          <GearIcon />
        </Link>
      </div>
    </header>
  );
}
