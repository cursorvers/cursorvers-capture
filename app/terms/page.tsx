export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-14 text-ink-200">
      <header className="mb-10 flex flex-col gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-ink-400">
          Cursorvers Capture
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tightest text-ink-50">
          利用規約
        </h1>
      </header>
      <div className="space-y-5 text-[14px] leading-relaxed">
        <p>
          本規約は、Cursorvers Inc.（以下「当社」）が提供する「Cursorvers
          Capture」（以下「本アプリ」）の利用条件を定めます。本アプリは
          <strong className="text-ink-50">
            experimental（実験的サービス）
          </strong>
          です。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          1. 本アプリの性質と利用範囲（重要）
        </h2>
        <p>
          本アプリは、ユーザーが撮影した領収書・名刺・メモ等を Google
          Drive へ整理するための
          <strong className="text-ink-50">補助的な整理ツール</strong>{" "}
          です。次の点を明確にします。
        </p>
        <ul className="list-inside list-disc space-y-2 pl-2">
          <li>
            本アプリは
            <strong className="text-ink-50">
              電子帳簿保存法（改正電子帳簿保存法・2024 年 1 月 1 日完全施行）
              のスキャナ保存要件を満たしません
            </strong>
            。認定タイムスタンプ、訂正削除履歴の確認システム、解像度・カラー
            要件、検索機能等の法定要件に対応していません（JIIMA 認証も未取得）。
          </li>
          <li>
            領収書等の
            <strong className="text-ink-50">紙原本は、ユーザーの責任で別途保管してください</strong>
            。本アプリへの保存をもって紙原本を破棄することは、法令違反となる
            可能性があります。
          </li>
          <li>
            税務申告に用いる正式な電子保存が必要な場合は、JIIMA 認証取得済の
            別サービス（freee 受領 BOX、Money Forward クラウドファクト、
            弥生スキャン保存等）をご利用ください。
          </li>
          <li>
            本アプリは、確定申告書類作成のために
            <strong className="text-ink-50">税理士へ領収書を共有する際の整理・閲覧</strong>
            、社内での書類分類補助、撮影忘れ防止を主目的とします。
          </li>
        </ul>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          2. 禁止行為
        </h2>
        <p>ユーザーは、以下を行ってはなりません。</p>
        <ul className="list-inside list-disc space-y-2 pl-2">
          <li>法令に違反する行為、犯罪に結びつく行為</li>
          <li>第三者の著作権・商標・プライバシーその他の権利を侵害する行為</li>
          <li>
            当社・他利用者・第三者に不利益・損害・過度な負荷を与える行為
          </li>
          <li>
            本アプリや関連インフラへの不正アクセス、改ざん、リバースエンジ
            ニアリング（法令で許容される範囲を除く）
          </li>
          <li>違法・有害コンテンツをアップロード・共有する行為</li>
          <li>
            招待制を逸脱した営利・再販・ボット利用等、当社が不適切と判断する
            利用形態
          </li>
        </ul>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          3. AI 機能とモデレーション
        </h2>
        <p>
          オプションの OCR・音声要約・チャット等は自動処理であり、結果の正確
          性・完全性は保証されません。Medical / Legal
          等の高リスク判断への利用は避けてください。当社は、違法・不正・規約
          違反が疑われる利用に対し、
          <strong className="text-ink-50">
            予告なく利用停止・データ削除・連携停止
          </strong>
          等の措置を講じる場合があります。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          4. 免責・保証の否認
        </h2>
        <p>
          本アプリは{" "}
          <strong className="text-ink-50">現状有姿（AS IS）</strong> で提供さ
          れ、
          <strong className="text-ink-50">
            明示黙示を問わずいかなる保証もしません
          </strong>
          。 experimental
          段階のため、仕様変更・中断・終了が随時発生し得ます。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          5. 料金とプラン
        </h2>
        <p>
          現在は実証・招待制を主とします。将来の{" "}
          <strong className="text-ink-50">Phase B</strong>{" "}
          において、有償プラン・利用制限・別途の契約条件が導入される場合があ
          ります。その際は事前に本ページまたはアプリ内通知で周知するよう努め
          ます。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          6. 準拠法・裁判管轄
        </h2>
        <p>
          本規約は{" "}
          <strong className="text-ink-50">日本法</strong>{" "}
          に準拠します。紛争については、当社本店所在地を管轄する裁判所を専属
          的合意管轄とします。
        </p>

        <h2 className="pt-6 font-display text-lg font-semibold text-ink-50">
          7. お問い合わせ
        </h2>
        <p>
          <a
            href="mailto:info@cursorvers.com"
            className="text-accent-soft underline-offset-2 hover:underline"
          >
            info@cursorvers.com
          </a>
        </p>
      </div>
    </article>
  );
}
