import type { JSX } from "react";
import Link from "next/link";

export const metadata = {
  title: "試用期間終了 — Cursorvers Capture",
};

export default function TrialExpiredPage(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[440px] flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-orange-300/80">
          Trial Ended
        </p>
        <h1 className="text-2xl font-semibold text-ink-100">
          60 日間の試用期間が終了しました
        </h1>
        <p className="text-sm leading-relaxed text-ink-300">
          ご利用ありがとうございました。
          <br />
          継続してご利用いただくには、Capture Standard プランへのアップグレードが必要です。
        </p>
      </div>

      <div className="w-full space-y-3 rounded-2xl border border-hairline bg-ink-800/40 p-5 text-left text-sm leading-relaxed text-ink-200">
        <p className="font-medium text-ink-100">Capture Standard で使えること</p>
        <ul className="list-disc space-y-1 pl-5 text-ink-300">
          <li>撮影と Google Drive 保存 (無制限)</li>
          <li>領収書・名刺・メモの AI 自動振り分け</li>
          <li>履歴の検索と再アップロード</li>
          <li>OCR + 構造化抽出</li>
        </ul>
        <p className="border-t border-hairline pt-3 text-[0.75rem] text-ink-400">
          ※ Cursorvers note 有料会員 (Cursorvers Pro) とは独立した課金です。
          note 会員でも Capture のご利用には別途お申し込みが必要です。
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <button
          type="button"
          disabled
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white shadow-card transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Capture Standard へアップグレード (近日公開)
        </button>
        <p className="text-[0.75rem] text-ink-400">
          料金とお申し込みは{" "}
          <a
            href="mailto:flux@cursorvers.com?subject=Cursorvers%20Capture%20Standard%20%E7%94%B3%E8%BE%BC"
            className="underline decoration-dotted underline-offset-4 hover:text-ink-200"
          >
            flux@cursorvers.com
          </a>{" "}
          までお問い合わせください。
        </p>
      </div>

      <Link
        href="/"
        className="text-[0.75rem] text-ink-400 underline decoration-dotted underline-offset-4 hover:text-ink-200"
      >
        ホームへ戻る
      </Link>
    </main>
  );
}
