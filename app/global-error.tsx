"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body className="antialiased bg-neutral-950 text-neutral-50 min-h-screen">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
          <p className="text-sm text-neutral-400">エラーが発生しました。</p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-neutral-800 px-4 py-3 text-sm font-medium text-neutral-50 hover:bg-neutral-700"
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
