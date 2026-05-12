'use client';

import Link from 'next/link';
import { SignInButton } from './SignInButton';
import { useTier } from '../lib/tier';

export function Header() {
  const { tier, email } = useTier();

  return (
    <header className="flex items-center justify-between p-4 bg-navy-800 text-white shadow-md">
      <Link href="/" className="text-xl font-mono text-orange-400 font-bold tracking-tight">
        Cursorvers
      </Link>
      <div className="flex items-center space-x-4">
        {email && (
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${tier === 'pro' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black' : 'bg-gray-700 text-gray-200'}`}
          >
            {tier === 'pro' ? 'PRO' : 'FREE'}
          </span>
        )}
        <SignInButton />
      </div>
    </header>
  );
}
