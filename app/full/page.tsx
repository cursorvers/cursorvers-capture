export default function FullPage() {
  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.16))] flex-col items-center justify-center bg-navy-900 p-4 text-gray-100">
      <h1 className="mb-4 text-center text-2xl font-bold text-orange-400">
        お試し定員に達しました
      </h1>
      <p className="max-w-md text-center text-sm text-gray-300">
        お問い合わせ:{" "}
        <a
          href="mailto:info@cursorvers.com"
          className="text-orange-400 underline hover:text-orange-300"
        >
          info@cursorvers.com
        </a>
      </p>
    </div>
  );
}
