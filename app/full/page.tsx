export default function FullPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-md flex-col items-center justify-center gap-6 px-5 py-12 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[0.625rem] uppercase tracking-[0.18em] text-amber-200">
        Capacity reached
      </span>
      <h1 className="font-display text-3xl font-semibold tracking-tightest text-ink-50">
        お試し定員に達しました
      </h1>
      <p className="max-w-sm text-[0.875rem] leading-relaxed text-ink-300">
        現在、お試し利用の定員に達しているため、新規のサインインを一時的に
        受け付けておりません。空きが出次第ご案内します。
      </p>
    </div>
  );
}
