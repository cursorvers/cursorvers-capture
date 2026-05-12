export default function TermsPage() {
  return (
    <div className="container mx-auto p-6 bg-navy-900 text-gray-100 min-h-[calc(100vh-theme(spacing.16))]">
      <h1 className="text-3xl font-bold text-orange-400 mb-6">利用規約</h1>
      <p className="text-gray-300 mb-4">
        本ページは S11 で本文化されます。現在はプレースホルダです。
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2">
        <li>目的: 本アプリは、Cursorvers 顧問先の皆様が税務処理に必要なレシート画像を Google Drive に簡単にアップロードすることを目的としています。</li>
        <li>利用資格: 本アプリは、招待されたCursorvers顧問先のみが利用できます。</li>
        <li>禁止事項: 不正な目的での利用、他者の権利を侵害する行為、法令に違反する行為を禁じます。</li>
        <li>免責事項: アプリの利用によって生じたいかなる損害についても、当方は責任を負いません。</li>
        <li>改定: 本利用規約は、事前の通知なく改定されることがあります。</li>
      </ul>
    </div>
  );
}
