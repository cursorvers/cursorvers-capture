import Link from 'next/link';

export function Footer() {
  return (
    <footer className="w-full p-4 bg-gray-800 text-gray-400 text-center text-sm mt-8">
      <p className="mb-2">
        © 2026 Cursorvers Inc. |
        <Link href="/privacy" className="underline hover:text-white ml-1">
          プライバシー
        </Link>
        |
        <Link href="/terms" className="underline hover:text-white ml-1">
          利用規約
        </Link>
      </p>
    </footer>
  );
}
