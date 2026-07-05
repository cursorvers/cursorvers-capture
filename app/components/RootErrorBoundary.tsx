"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

/**
 * Root-level error boundary.
 *
 * Phase 22.3: client-side crash で skeleton ごと unmount してしまい完全白画面に
 * なる事故を防ぐため、layout 直下に配置する。
 *
 * 失敗時はユーザーに「再読込」ボタン + エラー概要を出す。
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    // 構造化ログ。CF Pages Functions の console には届かないが、
    // 開発者 console には残るので founder の DevTools で確認可能。
    console.error("[RootErrorBoundary]", {
      message: error.message,
      stack: error.stack?.slice(0, 500),
      componentStack: info.componentStack?.slice(0, 500),
    });
  }

  handleReload = (): void => {
    if (typeof window !== "undefined") window.location.reload();
  };

  handleHardReset = async (): Promise<void> => {
    if (typeof window === "undefined") return;
    try {
      // SW 登録解除
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      // Caches API 全削除
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* best-effort */
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    const msg = this.state.error?.message ?? "Unknown error";
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5 py-12 text-ink-100">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-[0.625rem] uppercase tracking-[0.2em] text-ink-400">
            Cursorvers Capture
          </span>
          <h1 className="text-[1.375rem] font-semibold text-ink-50">
            画面の表示に失敗しました
          </h1>
          <p className="text-[0.8125rem] leading-relaxed text-ink-300">
            再読込で復旧する場合が多いです。何度繰り返してもダメな場合は
            「キャッシュごとリセット」をお試しください。
          </p>
        </div>
        <details className="w-full rounded-2xl border border-hairline bg-ink-900/40 px-4 py-3 text-[0.6875rem] text-ink-300">
          <summary className="cursor-pointer text-ink-400">
            エラー詳細 (開発者向け)
          </summary>
          <p className="mt-2 break-all font-mono text-[0.625rem] text-ink-400">
            {msg.slice(0, 240)}
          </p>
        </details>
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-accent px-5 text-[0.875rem] font-medium text-white shadow-glow transition active:scale-[0.98] hover:bg-accent/90"
          >
            🔄 再読込
          </button>
          <button
            type="button"
            onClick={() => void this.handleHardReset()}
            className="inline-flex h-10 w-full items-center justify-center rounded-2xl border border-hairline bg-ink-900/70 px-5 text-[0.75rem] text-ink-300 hover:border-white/15 hover:bg-ink-900"
          >
            🧹 キャッシュごとリセット + 再読込
          </button>
        </div>
        <p className="text-[0.6875rem] text-ink-500">
          問題が続く場合は <a className="underline" href="mailto:flux@cursorvers.com">flux@cursorvers.com</a> までご連絡ください
        </p>
      </main>
    );
  }
}
