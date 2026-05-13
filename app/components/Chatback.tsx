"use client";

import React, { useState, useEffect, useCallback, type ReactNode } from "react";

type ChatbackProps = {
  driveFileId: string;
  assistExpandedContent?: ReactNode;
};

type ChatbackStatus = "idle" | "pending" | "done" | "failed";

type ChatbackState = {
  status: ChatbackStatus;
  chatbackText?: string;
  suggestedTags?: string[];
};

const POLLING_INTERVAL_MS = 1000;
const MAX_POLLING_ATTEMPTS = 5;
const COLLAPSE_DIM_MS = 5000;

export function Chatback({ driveFileId, assistExpandedContent }: ChatbackProps) {
  const [chatbackState, setChatbackState] = useState<ChatbackState>({
    status: "pending",
  });
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [dimmed, setDimmed] = useState(false);

  useEffect(() => {
    if (!driveFileId || pollingAttempts >= MAX_POLLING_ATTEMPTS || chatbackState.status === "done") {
      return;
    }

    const pollChatback = async () => {
      try {
        const response = await fetch(`/api/chatback?id=${driveFileId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: { status: string; chatback_text?: string; suggested_tags?: string[] } =
          await response.json();

        if (data.status === "done") {
          setChatbackState({
            status: "done",
            chatbackText: data.chatback_text,
            suggestedTags: data.suggested_tags,
          });
        } else if (data.status === "failed") {
          setChatbackState({ status: "failed" });
        } else {
          setPollingAttempts((prev) => prev + 1);
        }
      } catch (error) {
        console.error("Polling for chatback failed:", error);
        setPollingAttempts((prev) => prev + 1);
        if (pollingAttempts + 1 >= MAX_POLLING_ATTEMPTS) {
          setChatbackState({ status: "failed" });
        }
      }
    };

    const timer = setInterval(pollChatback, POLLING_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [driveFileId, pollingAttempts, chatbackState.status]);

  useEffect(() => {
    if (chatbackState.status !== "done" || expanded) {
      return;
    }
    setDimmed(false);
    const t = window.setTimeout(() => setDimmed(true), COLLAPSE_DIM_MS);
    return () => window.clearTimeout(t);
  }, [chatbackState.status, expanded, chatbackState.chatbackText]);

  const onToggle = useCallback(() => {
    setExpanded((e) => !e);
    setDimmed(false);
  }, []);

  if (chatbackState.status === "failed" || chatbackState.status === "idle") {
    return null;
  }

  const showAssist = expanded && assistExpandedContent;

  return (
    <div
      className={`fixed bottom-16 left-4 right-4 z-40 mx-auto max-w-md transition-opacity duration-500 sm:left-16 sm:right-16 ${
        dimmed && !expanded ? "opacity-40" : "opacity-100"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full rounded-2xl border border-neutral-700 bg-neutral-900/95 px-4 py-3 text-left shadow-lg backdrop-blur-sm"
        aria-expanded={expanded}
      >
        {chatbackState.status === "pending" ? (
          <div className="flex items-center text-neutral-200">
            <svg
              className="-ml-1 mr-3 h-5 w-5 shrink-0 animate-spin text-neutral-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Codex が分析中…</span>
          </div>
        ) : null}
        {chatbackState.status === "done" && chatbackState.chatbackText ? (
          <div className="text-neutral-100">
            <p className="text-sm">{chatbackState.chatbackText}</p>
            {chatbackState.suggestedTags && chatbackState.suggestedTags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {chatbackState.suggestedTags.map((tag, index) => (
                  <span
                    key={index}
                    className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </button>
      {showAssist ? (
        <div className="mt-2 space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/90 p-3">
          {assistExpandedContent}
        </div>
      ) : null}
    </div>
  );
}
