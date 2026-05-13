"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="bg-navy-800 p-4 text-white shadow-md">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-orange-400 hover:text-orange-300"
        >
          Cursorvers Capture
        </Link>
        <Link
          href="/settings"
          className="rounded-md p-2 text-xl text-gray-200 hover:bg-white/10 hover:text-white"
          aria-label="設定"
        >
          ⚙️
        </Link>
      </div>
    </header>
  );
}
