import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto w-full border-t border-hairline px-5 py-6">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-1.5 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-400">
          experimental · Cursorvers Capture
        </p>
        <nav className="flex items-center gap-4 text-[0.6875rem] text-ink-400">
          <Link
            href="/privacy"
            className="transition hover:text-ink-100"
          >
            Privacy
          </Link>
          <span aria-hidden className="h-3 w-px bg-white/10" />
          <Link
            href="/terms"
            className="transition hover:text-ink-100"
          >
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
