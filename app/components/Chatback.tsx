'use client';

import React, { useState, useEffect } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { type CodexChatbackResult } from '@/app/lib/codex-app-server';

type ChatbackProps = {
  driveFileId: string;
};

type ChatbackStatus = 'idle' | 'pending' | 'done' | 'failed';

type ChatbackState = {
  status: ChatbackStatus;
  chatbackText?: string;
  suggestedTags?: string[];
  updatedMetadata?: object;
};

const POLLING_INTERVAL_MS = 1000; // 1 second
const MAX_POLLING_ATTEMPTS = 5; // Poll 5 times

export function Chatback({ driveFileId }: ChatbackProps) {
  const [chatbackState, setChatbackState] = useState<ChatbackState>({
    status: 'pending',
  });
  const [pollingAttempts, setPollingAttempts] = useState(0);

  useEffect(() => {
    if (!driveFileId || pollingAttempts >= MAX_POLLING_ATTEMPTS || chatbackState.status === 'done') {
      return;
    }

    const pollChatback = async () => {
      try {
        const response = await fetch(`/api/chatback?id=${driveFileId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.status === 'done') {
          setChatbackState({
            status: 'done',
            chatbackText: data.chatback_text,
            suggestedTags: data.suggested_tags,
            updatedMetadata: data.updated_metadata,
          });
        } else if (data.status === 'failed') {
          setChatbackState({ status: 'failed' });
        } else {
          setPollingAttempts((prev) => prev + 1);
        }
      } catch (error) {
        console.error('Polling for chatback failed:', error);
        setPollingAttempts((prev) => prev + 1);
        // On error, we still increment attempts, eventually leading to silent failure.
        if (pollingAttempts + 1 >= MAX_POLLING_ATTEMPTS) {
          setChatbackState({ status: 'failed' });
        }
      }
    };

    const timer = setInterval(pollChatback, POLLING_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [driveFileId, pollingAttempts, chatbackState.status]);

  if (chatbackState.status === 'failed' || chatbackState.status === 'idle') {
    return null; // Silently skip on failure or idle
  }

  if (chatbackState.status === 'pending') {
    return (
      <div className="text-neutral-200 bg-neutral-800 rounded-lg p-3 mt-2 flex items-center">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Codex が分析中…</span>
      </div>
    );
  }

  if (chatbackState.status === 'done' && chatbackState.chatbackText) {
    return (
      <div className="text-neutral-200 bg-neutral-800 rounded-lg p-3 mt-2">
        <p>{chatbackState.chatbackText}</p>
        {chatbackState.suggestedTags && chatbackState.suggestedTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {chatbackState.suggestedTags.map((tag, index) => (
              <span key={index} className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
