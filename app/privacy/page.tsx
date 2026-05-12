export default function PrivacyPage() {
  return (
    <div className="container mx-auto p-6 bg-navy-900 text-gray-100 min-h-[calc(100vh-theme(spacing.16))]">
      <h1 className="text-3xl font-bold text-orange-400 mb-6">プライバシーポリシー</h1>
      <p className="text-gray-300 mb-4">
        本ページは S11 で本文化されます。現在はプレースホルダです。
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2">
        <li>Google Drive API の利用: ファイルアップロードのため。</li>
        <li>ユーザーデータ: Googleアカウントのメールアドレスのみ取得・利用します。</li>
        <li>個人特定情報: アプリはレシート画像から個人特定情報を収集しません。</li>
        <li>データ保持: レシート画像は端末内で一時保持され、Google Drive アップロード後に自動削除されます。</li>
        <li>第三者共有: ユーザーデータは第三者と共有されません。</li>
      </ul>
    </div>
  );
}
