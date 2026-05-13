"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from "react";
import { useTier } from "@/app/lib/tier";
import {
  loadAdvisoryHistory,
  saveAdvisoryHistory,
  type AdvisoryChatMessage,
} from "@/app/lib/advisory-history-idb";

export default function AdvisoryPage(): JSX.Element {
  const { tier, email, isLoading } = useTier();
  const chatgptUserId = email ?? "anonymous";
  const [messages, setMessages] = useState<AdvisoryChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const hist = await loadAdvisoryHistory(chatgptUserId);
        if (!cancelled) {
          setMessages(hist);
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatgptUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const persist = useCallback(
    async (next: AdvisoryChatMessage[]) => {
      setMessages(next);
      try {
        await saveAdvisoryHistory(chatgptUserId, next);
      } catch {
        /* ignore idb errors */
      }
    },
    [chatgptUserId],
  );

  const canSend = useMemo(
    () => tier === "pro" && input.trim().length > 0 && !pending,
    [tier, input, pending],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || tier !== "pro") {
      return;
    }
    setPending(true);
    setError(null);
    const historyPayload = messages;
    const afterUser: AdvisoryChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    await persist(afterUser);
    setInput("");
    try {
      const res = await fetch("/api/advisory", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const replyText =
        typeof data.reply === "string"
          ? data.reply
          : "応答形式が不正でした";
      await persist([
        ...afterUser,
        { role: "assistant", content: replyText },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setPending(false);
    }
  }, [input, tier, messages, persist]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-theme(spacing.16))] items-center justify-center bg-navy-900 text-gray-300">
        読み込み中…
      </div>
    );
  }

  if (tier !== "pro") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-theme(spacing.16))] max-w-lg flex-col items-center justify-center gap-4 bg-navy-900 p-6 text-center text-gray-200">
        <p className="text-lg font-semibold text-orange-400">
          Advisory は Pro tier 限定です
        </p>
        <p className="text-sm text-gray-400">
          Pro アカウントでサインインするとチャットをご利用いただけます。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-theme(spacing.16))] max-w-lg flex-col bg-navy-900 p-4 text-gray-100">
      <h1 className="mb-3 text-center text-xl font-bold text-orange-400">
        💬 Advisory
      </h1>
      <div className="flex min-h-[320px] flex-col gap-2 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-950/40 p-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-neutral-500">
            メッセージを送信して相談を始めましょう。
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-orange-600 text-black"
                  : "mr-auto border border-neutral-600 bg-neutral-900 text-gray-100"
              }`}
            >
              {m.content}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      {error ? (
        <p className="mt-2 text-center text-sm text-red-400">{error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="相談内容を入力…"
          className="flex-1 rounded-lg border border-neutral-600 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
          disabled={pending}
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void send()}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-40"
        >
          {pending ? "…" : "送信"}
        </button>
      </div>
    </div>
  );
}
