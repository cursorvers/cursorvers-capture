import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto w-full px-4 py-3 text-center">
      <p className="text-[11px] text-neutral-500">
        初月 experimental ·{" "}
        <Link href="/privacy" className="underline hover:text-neutral-300">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline hover:text-neutral-300">
          Terms
        </Link>
      </p>
    </footer>
  );
}
