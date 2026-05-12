export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center max-w-md mx-auto p-6 gap-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Gdrive Uploader</h1>
      <p className="text-neutral-400 text-sm leading-relaxed">
        撮影 → 指定の Google Drive へ即アップロード
      </p>
      <div className="flex w-full flex-col gap-3 pt-2">
        <button
          type="button"
          disabled
          className="w-full bg-neutral-800 rounded-xl px-4 py-3 opacity-60 cursor-not-allowed text-sm font-medium"
        >
          Google でサインイン (S2)
        </button>
        <button
          type="button"
          disabled
          className="w-full bg-neutral-800 rounded-xl px-4 py-3 opacity-60 cursor-not-allowed text-sm font-medium"
        >
          📷 撮影 (S3)
        </button>
      </div>
      <p className="mt-8 text-xs text-neutral-500">v0.1 — S1 scaffold</p>
    </main>
  );
}
