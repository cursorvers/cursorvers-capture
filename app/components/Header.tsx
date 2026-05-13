'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SignInButton } from './SignInButton';
import { useTier } from '../lib/tier';

export function Header() {
  const { tier, email } = useTier();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative flex flex-col bg-navy-800 p-4 text-white shadow-md">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="text-xl font-mono font-bold tracking-tight text-orange-400">
          Cursorvers
        </Link>

        <nav
          className="hidden items-center gap-4 text-sm md:flex"
          aria-label="メインナビゲーション"
        >
          <Link
            href="/insights"
            className="rounded-md px-2 py-1 text-gray-200 hover:bg-white/10 hover:text-orange-300"
          >
            📊 振り返り
          </Link>
          <Link
            href="/advisory"
            className="rounded-md px-2 py-1 text-gray-200 hover:bg-white/10 hover:text-orange-300"
          >
            💬 Advisory
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:gap-4">
          {email ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${tier === 'pro' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black' : 'bg-gray-700 text-gray-200'}`}
            >
              {tier === 'pro' ? 'PRO' : 'FREE'}
            </span>
          ) : null}
          <SignInButton />
          <button
            type="button"
            className="rounded-md p-2 text-xl md:hidden hover:bg-white/10"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label="メニューを開く"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ☰
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        className={`mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 text-sm md:hidden ${menuOpen ? '' : 'hidden'}`}
        aria-hidden={!menuOpen}
      >
        <Link
          href="/insights"
          className="rounded-md px-2 py-2 text-gray-100 hover:bg-white/10"
          onClick={() => setMenuOpen(false)}
        >
          📊 振り返り
        </Link>
        <Link
          href="/advisory"
          className="rounded-md px-2 py-2 text-gray-100 hover:bg-white/10"
          onClick={() => setMenuOpen(false)}
        >
          💬 Advisory
        </Link>
      </nav>
    </header>
  );
}
