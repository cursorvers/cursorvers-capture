import Link from "next/link";

export default function NotInvitedPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-md flex-col items-center justify-center gap-6 px-5 py-12 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/[0.02] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-ink-300">
        Restricted
      </span>
      <h1 className="font-display text-3xl font-semibold tracking-tightest text-ink-50">
        ご招待されていません
      </h1>
      <p className="max-w-sm text-[14px] leading-relaxed text-ink-300">
        このアプリは Cursorvers 顧問先の方向けに、招待制で配布されています。
        アクセス権についてのお問い合わせは下記までご連絡ください。
      </p>
      <Link
        href="mailto:info@cursorvers.com"
        className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-ink-800/60 px-4 text-[13px] font-medium text-ink-100 transition hover:border-white/20 hover:bg-ink-800"
      >
        info@cursorvers.com
      </Link>
    </div>
  );
}
