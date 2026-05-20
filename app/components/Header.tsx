"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function BrandMark(): JSX.Element {
  // Capture motif: 領収書カード 1 枚 (giza ギザ底 + バー線) + AI スパーク。
  // app icon (document fan) の小サイズ版。
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className="h-5 w-5 shrink-0"
    >
      {/* Receipt card with jagged bottom edge */}
      <path
        d="M 5 7 H 22 V 24 L 20.2 22.8 L 18.5 24 L 16.8 22.8 L 15 24 L 13.2 22.8 L 11.5 24 L 9.8 22.8 L 8 24 L 6 22.8 L 5 24 Z"
        fill="#dde6f8"
      />
      <rect x="8" y="10" width="9" height="1.5" rx="0.7" fill="#0a1a4a"/>
      <rect x="8" y="13.5" width="11" height="1.2" rx="0.6" fill="#0a1a4a" opacity="0.5"/>
      <rect x="8" y="16.5" width="8" height="1.2" rx="0.6" fill="#0a1a4a" opacity="0.5"/>
      <rect x="8" y="19.5" width="5" height="1.8" rx="0.8" fill="#fb923c"/>
      {/* AI sparkle, top-right */}
      <path
        d="M 25.5 6 L 26.5 8.5 L 29 9.5 L 26.5 10.5 L 25.5 13 L 24.5 10.5 L 22 9.5 L 24.5 8.5 Z"
        fill="#fb923c"
      />
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
