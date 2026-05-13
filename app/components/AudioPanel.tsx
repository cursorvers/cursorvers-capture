'use client';

import { blobToBase64 } from '@/app/lib/audio';
import { updateMetadata } from '@/app/lib/drive';
import type { AudioResult } from '@/app/lib/codex-app-server';
import {
  useCallback,
  useEffect,
  useState,
  type JSX,
} from 'react';

export interface AudioPanelProps {
  driveFileId: string;
  audioBlob: Blob;
}

function readBlobDurationMs(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(0);
      return;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const cleanup = (): void => {
      URL.revokeObjectURL(url);
    };
    audio.preload = 'metadata';
    audio.src = url;
    audio.addEventListener('loadedmetadata', () => {
      const sec = Number.isFinite(audio.duration) ? audio.duration : 0;
      cleanup();
      resolve(Math.max(1, Math.round(sec * 1000)));
    });
    audio.addEventListener('error', () => {
      cleanup();
      resolve(1000);
    });
  });
}

export function AudioPanel({
  driveFileId,
  audioBlob,
}: AudioPanelProps): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AudioResult | null>(null);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const runTranscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const audio_base64 = await blobToBase64(audioBlob);
      const duration_ms = await readBlobDurationMs(audioBlob);
      const mime = audioBlob.type || 'audio/webm';

      const response = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drive_file_id: driveFileId,
          audio_base64,
          mime,
          duration_ms,
        }),
      });

      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errObj = data as { error?: string };
        throw new Error(errObj.error ?? 'Audio request failed');
      }

      const audioResult = data as AudioResult;
      setResult(audioResult);
      setEditedTranscript(audioResult.transcript ?? '');
      setEditedSummary(audioResult.summary ?? audioResult.cleaned_text ?? '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [audioBlob, driveFileId]);

  useEffect(() => {
    void runTranscription();
  }, [runTranscription]);

  const handleConfirm = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await updateMetadata(driveFileId, {
        audio_transcript: editedTranscript,
        audio_summary: editedSummary,
      });
      setConfirmed(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 w-full rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-left text-sm text-neutral-400">
      <h2 className="mb-3 text-lg font-semibold text-neutral-200">
        音声メモ
      </h2>

      {loading && !confirmed ? (
        <p className="text-blue-400">文字起こし中...</p>
      ) : null}
      {error ? <p className="text-red-400">エラー: {error}</p> : null}

      {result && !confirmed ? (
        <div className="flex flex-col gap-3">
          <label className="block text-xs font-medium text-neutral-200">
            トランスクリプト
          </label>
          <textarea
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
            rows={5}
            value={editedTranscript}
            onChange={(e) => setEditedTranscript(e.target.value)}
          />
          <label className="block text-xs font-medium text-neutral-200">
            要約
          </label>
          <textarea
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
            rows={4}
            value={editedSummary}
            onChange={(e) => setEditedSummary(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={loading}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-60"
          >
            Drive に保存
          </button>
        </div>
      ) : null}

      {confirmed ? (
        <p className="text-green-400">音声メモを Drive のメタデータに保存しました。</p>
      ) : null}
    </div>
  );
}
