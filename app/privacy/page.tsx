export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-14 text-ink-200">
      <header className="mb-10 flex flex-col gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-ink-400">
          Cursorvers Capture
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tightest text-ink-50">
          プライバシーポリシー
        </h1>
      </header>
      <div className="space-y-5 text-[14px] leading-relaxed">
        <p>
          本ポリシーは、Cursorvers Inc.（以下「当社」）が提供する実験的 Web
          アプリ「Cursorvers Capture」（以下「本アプリ」）における個人情報等
          の取扱いを説明するためのものです。本アプリは
          <strong className="text-ink-50">初月 experimental</strong>
          の提供段階にあり、随時更新されることがあります。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          1. 処理者と管理者
        </h2>
        <p>
          Google アカウントに関連する認証・Cookie およびサーバー側で保持する
          メタデータについて、当社は個人データの
          <strong className="text-ink-50">処理者（processor）</strong>
          として、招待制の運用・不正利用防止・お問い合わせ対応の範囲で処理し
          ます。ユーザーご自身の Google アカウントおよび Google
          Drive 上のファイルについて、ユーザーは自らが
          <strong className="text-ink-50">管理者（controller）</strong>
          に該当します。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          2. 取得する情報と利用目的
        </h2>
        <p>
          本アプリは、Google OAuth / Google Identity Services を通じて
          Google アカウントの識別に必要な範囲の情報にアクセスします。OAuth
          スコープは
          <strong className="text-ink-50">drive.file</strong>
          等、ファイル作成・参照に必要な最小限に限定します。クライアント
          （ブラウザ）から Google Drive API
          へ直接アップロードする構成であり、画像バイナリが当社サーバーを経由
          して恒常的に保存されることはありません（運用上のログ・メトリクスを
          除く）。
        </p>
        <p>
          端末内では、フォルダ ID や端末識別子、オプション機能の ON/OFF 等を
          IndexedDB / localStorage に保存することがあります。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          3. サーバーに保存するデータと暗号化（KV）
        </h2>
        <p>
          オプションの AI 分析（OCR・音声要約・チャットバック等）を利用する
          場合、当社が指定するバックエンド（例: Codex App Server 経由の一時
          処理）にコンテンツが送られることがあります。その場合、当社方針と
          して
          <strong className="text-ink-50">一時処理のみ（no retention）</strong>
          とし、当社の持久ストレージとして画像・音声本文を保存しないことを
          意図しています。実装の都合上、処理状況や結果のメタデータを
          Key-Value ストアに保持する場合がありますが、当該値は
          <strong className="text-ink-50">AES-256-GCM</strong>
          で暗号化されたうえで保存し、利用可能な鍵は{" "}
          <code className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-100">
            KV_ENCRYPTION_KEY
          </code>{" "}
          または{" "}
          <code className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-100">
            COOKIE_SECRET
          </code>{" "}
          から導出します。保管される識別子は主に{" "}
          <strong className="text-ink-50">user_id 相当のトークン・tier</strong>{" "}
          など最小限に留めます。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          4. サインイン Cookie（gdrive_email）
        </h2>
        <p>
          サーバー側の認可・課金区分の判定に用いるため、Google アカウントの
          メールアドレスを
          <strong className="text-ink-50">
            httpOnly Cookie（gdrive_email）
          </strong>
          に保存し、改ざん検知のために
          <strong className="text-ink-50">HMAC</strong>
          付きの署名形式で運用します。Edge Middleware では完全な署名検証を
          省略し、電子メール部分の抽出のみ行う場合があります。確実な検証は
          Node.js 環境の API で行います。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          5. 第三者提供
        </h2>
        <p>
          個人情報を、法令に基づく開示請求等の例外を除き、当社の裁量で第三者
          に販売・提供することはありません。AI
          処理を行う際は、当社が契約するクラウド処理基盤・モデル提供者へ必要
          最小限のデータが送信される場合がありますが、これはサービス提供のた
          めの委託・処理に限られます。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          6. 保存期間・削除
        </h2>
        <p>
          Cookie およびサーバー側メタデータは、各機能の TTL・運用方針に従い
          削除されます。ユーザーは Google アカウント側の権限解除、本アプリ
          設定からのサインアウト、端末データ消去により、ローカル情報を削除で
          きます。Drive 上のファイル削除はユーザー自身の Google アカウント
          操作に依存します。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          7. お問い合わせ
        </h2>
        <p>
          本ポリシーに関するご請求・ご質問は{" "}
          <a
            href="mailto:info@cursorvers.com"
            className="text-accent-soft underline-offset-2 hover:underline"
          >
            info@cursorvers.com
          </a>{" "}
          までご連絡ください。
        </p>
      </div>
    </article>
  );
}
