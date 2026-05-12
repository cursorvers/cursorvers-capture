export default function NotInvitedPage() {
  return (
    <div className="flex min-h-[calc(100vh-theme(spacing.16))] flex-col items-center justify-center p-4 bg-navy-900 text-gray-100">
      <h1 className="text-3xl font-bold text-orange-400 mb-4">
        ご招待されていません
      </h1>
      <p className="text-lg text-gray-300 text-center max-w-md">
        このアプリは Cursorvers 顧問先の方向けに配布されています。
      </p>
      <p className="text-md text-gray-400 text-center mt-2 max-w-md">
        お問い合わせは <a href="mailto:info@cursorvers.com" className="underline text-orange-400">info@cursorvers.com</a>
      </p>
    </div>
  );
}
