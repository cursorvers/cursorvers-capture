export default function TermsPage() {
  return (
    <div className="container mx-auto min-h-[calc(100vh-theme(spacing.16))] max-w-3xl bg-navy-900 p-6 text-gray-100">
      <h1 className="mb-6 text-3xl font-bold text-orange-400">利用規約</h1>
      <div className="space-y-4 text-sm leading-relaxed text-gray-300">
        <p>
          本規約は、Cursorvers Inc.（以下「当社」）が提供する「Cursorvers Capture」（以下「本アプリ」）の利用条件を定めます。本アプリは
          <strong className="text-gray-200">experimental（実験的サービス）</strong>
          です。
        </p>

        <h2 className="pt-4 text-lg font-semibold text-orange-300">1. 禁止行為</h2>
        <p>ユーザーは、以下を行ってはなりません。</p>
        <ul className="list-inside list-disc space-y-2 pl-2">
          <li>法令に違反する行為、犯罪に結びつく行為</li>
          <li>第三者の著作権・商標・プライバシーその他の権利を侵害する行為</li>
          <li>当社・他利用者・第三者に不利益・損害・過度な負荷を与える行為</li>
          <li>本アプリや関連インフラへの不正アクセス、改ざん、リバースエンジニアリング（法令で許容される範囲を除く）</li>
          <li>違法・有害コンテンツをアップロード・共有する行為</li>
          <li>招待制を逸脱した営利・再販・ボット利用等、当社が不適切と判断する利用形態</li>
        </ul>

        <h2 className="pt-4 text-lg font-semibold text-orange-300">2. AI 機能とモデレーション</h2>
        <p>
          オプションの OCR・音声要約・チャット等は自動処理であり、結果の正確性・完全性は保証されません。Medical / Legal
          等の高リスク判断への利用は避けてください。当社は、違法・不正・規約違反が疑われる利用に対し、
          <strong className="text-gray-200">予告なく利用停止・データ削除・連携停止</strong>
          等の措置を講じる場合があります。
        </p>

        <h2 className="pt-4 text-lg font-semibold text-orange-300">3. 免責・保証の否認</h2>
        <p>
          本アプリは <strong className="text-gray-200">現状有姿（AS IS）</strong> で提供され、
          <strong className="text-gray-200">明示黙示を問わずいかなる保証もしません</strong>。
          experimental 段階のため、仕様変更・中断・終了が随時発生し得ます。
        </p>

        <h2 className="pt-4 text-lg font-semibold text-orange-300">4. Phase B・料金</h2>
        <p>
          現在は実証・招待制を主とします。将来の <strong className="text-gray-200">Phase B</strong>{" "}
          において、有償プラン・利用制限・別途の契約条件が導入される場合があります。その際は事前に本ページまたはアプリ内通知で周知するよう努めます。
        </p>

        <h2 className="pt-4 text-lg font-semibold text-orange-300">5. 準拠法・裁判管轄</h2>
        <p>
          本規約は <strong className="text-gray-200">日本法</strong> に準拠します。紛争については、当社本店所在地を管轄する裁判所を専属的合意管轄とします。
        </p>

        <h2 className="pt-4 text-lg font-semibold text-orange-300">6. お問い合わせ</h2>
        <p>
          <a href="mailto:info@cursorvers.com" className="text-orange-400 underline hover:text-orange-300">
            info@cursorvers.com
          </a>
        </p>
      </div>
    </div>
  );
}
