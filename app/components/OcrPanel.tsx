'use client';

import { useState, useEffect, useCallback, type JSX } from 'react';
import { getOcrEnabled } from '@/app/lib/ocr-toggle';
import { OcrResult } from '@/app/lib/codex-app-server'; // For OcrResult type
import { updateMetadata } from '@/app/lib/drive'; // For updating Drive file metadata

interface OcrPanelProps {
  driveFileId: string;
  imageBase64: string;
}

export function OcrPanel({ driveFileId, imageBase64 }: OcrPanelProps): JSX.Element | null {
  const [ocrEnabled, setOcrEnabled] = useState<boolean | null>(null); // null means loading
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [editing, setEditing] = useState(false); // For confidence < 0.9
  const [confirmed, setConfirmed] = useState(false); // For confidence >= 0.9
  const [error, setError] = useState<string | null>(null);

  // State for editable fields
  const [editedText, setEditedText] = useState<string>('');
  const [editedStructured, setEditedStructured] = useState<Record<string, string | number | undefined>>({});

  useEffect(() => {
    async function checkOcrStatus() {
      const enabled = await getOcrEnabled();
      setOcrEnabled(enabled);
    }
    void checkOcrStatus();
  }, []);

  const fetchOcrResult = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive_file_id: driveFileId, image_base64: imageBase64, mime: 'image/jpeg' }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'OCR request failed');
      }

      const data: OcrResult = await response.json();
      setOcrResult(data);
      setEditedText(data.extracted_text);

      const filteredStructured: Record<string, string | number | undefined> = {};
      if (data.structured) {
        for (const key in data.structured) {
          const value = data.structured[key];
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'undefined') {
            filteredStructured[key] = value;
          }
        }
      }
      setEditedStructured(filteredStructured);

      if (data.confidence >= 0.9) {
        setConfirmed(false); // User can optionally confirm
      } else {
        setEditing(true); // Mandatory edit
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [driveFileId, imageBase64, setConfirmed, setEditedStructured, setEditedText, setEditing, setError, setLoading, setOcrResult]);

  useEffect(() => {
    if (ocrEnabled === true && !ocrResult && !loading && !error) {
      void fetchOcrResult();
    }
  }, [ocrEnabled, ocrResult, loading, error, fetchOcrResult]);

  if (ocrEnabled === null) {
    return null; // Still checking OCR status
  }

  if (ocrEnabled === false) {
    return null; // OCR is disabled, render nothing
  }

  const handleSaveMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      const properties: Record<string, string> = {
        ocr_text: editedText,
        ocr_confidence: ocrResult?.confidence?.toString() || '0',
      };
      if (editedStructured.date) properties.ocr_date = String(editedStructured.date);
      if (editedStructured.amount) properties.ocr_amount = String(editedStructured.amount);
      if (editedStructured.vendor) properties.ocr_vendor = String(editedStructured.vendor);

      await updateMetadata(driveFileId, properties);
      setConfirmed(true);
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmHighConfidence = async () => {
    // If user clicks OK, we save the metadata immediately with existing result.
    await handleSaveMetadata();
  };

  return (
    <div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-left text-sm text-neutral-400 mb-4">
      <h2 className="text-lg font-semibold text-neutral-200 mb-3">OCR 自動抽出</h2>

      {loading && <p className="text-blue-400">抽出中...</p>}
      {error && <p className="text-red-400">エラー: {error}</p>}

      {ocrResult && !loading && (
        <div>
          {!editing && ocrResult.confidence >= 0.9 && !confirmed && (
            // High confidence, not yet confirmed
            <div className="mb-3">
              <p className="text-neutral-300 mb-2">以下の内容が抽出されました (自信度: {(ocrResult.confidence * 100).toFixed(0)}%)。</p>
              <textarea
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 opacity-75 cursor-not-allowed"
                rows={4}
                value={ocrResult.extracted_text}
                readOnly
              />
              {Object.keys(ocrResult.structured || {}).length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="text-neutral-500">構造化データ:</p>
                  {Object.entries(ocrResult.structured!).map(([key, value]) => (
                    <p key={key} className="ml-2 text-neutral-400">{key}: {String(value)}</p>
                  ))}
                </div>
              )}
              <button
                onClick={handleConfirmHighConfidence}
                className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
              >
                OK
              </button>
            </div>
          )}

          {editing || (ocrResult.confidence < 0.9 && !confirmed) ? (
            // Low confidence or mandatory edit
            <div className="mb-3">
              <p className="text-yellow-400 mb-2">内容を確認・修正してください (自信度: {(ocrResult.confidence * 100).toFixed(0)}%)。</p>
              <textarea
                className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
                rows={4}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
              />
              <div className="mt-3 grid grid-cols-1 gap-2">
                <label className="block text-neutral-200 text-xs font-medium">日付 (YYYY-MM-DD):</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
                  value={editedStructured.date || ''}
                  onChange={(e) => setEditedStructured({ ...editedStructured, date: e.target.value })}
                />
                <label className="block text-neutral-200 text-xs font-medium">金額:</label>
                <input
                  type="number"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
                  value={editedStructured.amount || ''}
                  onChange={(e) => setEditedStructured({ ...editedStructured, amount: parseFloat(e.target.value) || undefined })}
                />
                <label className="block text-neutral-200 text-xs font-medium">ベンダー:</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
                  value={editedStructured.vendor || ''}
                  onChange={(e) => setEditedStructured({ ...editedStructured, vendor: e.target.value })}
                />
              </div>
              <button
                onClick={handleSaveMetadata}
                className="mt-3 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
              >
                保存
              </button>
            </div>
          ) : null}

          {confirmed && (
            <p className="text-green-400">OCR結果が保存されました。</p>
          )}
        </div>
      )}
    </div>
  );
}
