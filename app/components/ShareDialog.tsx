'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { isValidEmail, normalizeEmail } from '../lib/email-validation';
import { shareWithEmail, revokeShare } from '../lib/share';
import { recordShare } from '../lib/share-history';

interface ShareDialogProps {
  driveFileId: string;
  filename: string;
  onClose: () => void;
}

type ShareStep = 'input' | 'preview' | 'sharing' | 'success';

const UNDO_TIMEOUT_MS = 5000;

export function ShareDialog({ driveFileId, filename, onClose }: ShareDialogProps) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<ShareStep>('input');
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [permissionId, setPermissionId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const advisorEmail = searchParams.get('advisor');
    if (advisorEmail && isValidEmail(advisorEmail)) {
      setEmail(normalizeEmail(advisorEmail));
    }
  }, [searchParams]);

  const resetDialog = () => {
    setEmail('');
    setValidationError(null);
    setCurrentStep('input');
    setIsSharing(false);
    setShareError(null);
    setPermissionId(null);
    setIsUndoing(false);
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (validationError) {
      setValidationError(null);
    }
  };

  const validateAndProceed = () => {
    if (!email.trim()) {
      setValidationError('メールアドレスを入力してください。');
      return;
    }
    if (!isValidEmail(email)) {
      setValidationError('有効なメールアドレスを入力してください。');
      return;
    }
    setValidationError(null);
    setCurrentStep('preview');
  };

  const performShare = async () => {
    setIsSharing(true);
    setShareError(null);
    try {
      const normalizedEmail = normalizeEmail(email);
      const { permissionId: newPermissionId } = await shareWithEmail(driveFileId, normalizedEmail);
      setPermissionId(newPermissionId);
      await recordShare(driveFileId, normalizedEmail, newPermissionId, filename);
      setCurrentStep('success');

      undoTimeoutRef.current = setTimeout(async () => {
        // Banner disappears after timeout, if not undone
        if (permissionId === newPermissionId) { // Check if it's the same share that hasn't been undone yet
          onClose(); // Close dialog if undo not performed
        }
      }, UNDO_TIMEOUT_MS);

    } catch (error: unknown) {
      setShareError( (error instanceof Error ? error.message : 'Unknown error') || 'ファイルの共有に失敗しました。');
    } finally {
      setIsSharing(false);
    }
  };

  const handleUndo = async () => {
    if (!permissionId) return;

    setIsUndoing(true);
    setShareError(null);
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    try {
      await revokeShare(driveFileId, permissionId);
      // Optionally, delete from history if needed, but the spec says 'revokeFromHistory' handles both
      // For now, just show a message. 'revokeFromHistory' will be called from settings page.
      setPermissionId(null); // Clear permissionId as it's revoked
      // Instead of immediately closing, show a message that it was undone
      setShareError('共有を取り消しました。'); // Reusing shareError for general messages
      // Maybe change step to a 'undone' state, or just close after a short delay
      setTimeout(() => {
        onClose();
        resetDialog();
      }, 1500);
    } catch (error: unknown) {
      setShareError((error instanceof Error ? error.message : 'Unknown error') || '共有の取消に失敗しました。');
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
        <h2 className="text-xl font-bold mb-4">ファイルを共有</h2>

        {currentStep === 'input' && (
          <div>
            <p className="text-sm text-gray-700 mb-4">
              メールアドレスを指定して、このファイルを共有します。<br />
              共有先はユーザーの責任において行ってください。
            </p>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              共有先のメールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={handleEmailChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="name@example.com"
              disabled={isSharing}
            />
            {validationError && <p className="mt-2 text-sm text-red-600">{validationError}</p>}
            {shareError && <p className="mt-2 text-sm text-red-600">{shareError}</p>}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={isSharing}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={validateAndProceed}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={isSharing || !email.trim()}
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {currentStep === 'preview' && (
          <div>
            <p className="text-sm text-gray-700 mb-4">
              <span className="font-bold text-lg">{normalizeEmail(email)}</span> に reader 権限で
              <span className="font-bold text-lg"> {filename}</span> を共有します。<br />
              typo がないか確認してください。
            </p>
            <p className="text-xs text-gray-500 mt-4">
              共有先はユーザーの責任において行ってください。(Z3 法的免責準拠)
            </p>
            {shareError && <p className="mt-2 text-sm text-red-600">{shareError}</p>}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setCurrentStep('input')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={isSharing}
              >
                戻る
              </button>
              <button
                type="button"
                onClick={performShare}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                disabled={isSharing}
              >
                {isSharing ? '共有中...' : '共有実行'}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'success' && (
          <div className="flex flex-col items-center">
            <p className="text-green-600 text-lg font-bold mb-4">✅ 共有しました。</p>
            {shareError === '共有を取り消しました。' ? (
              <p className="text-sm text-gray-700">{shareError}</p>
            ) : (
              <p className="text-sm text-gray-700">取消は {UNDO_TIMEOUT_MS / 1000} 秒以内</p>
            )}
            <div className="mt-4">
              <button
                type="button"
                onClick={handleUndo}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                disabled={isUndoing || !permissionId || shareError === '共有を取り消しました。'}
              >
                {isUndoing ? '取消中...' : '取消'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  resetDialog();
                }}
                className="ml-3 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                閉じる
              </button>
            </div>
            {shareError && shareError !== '共有を取り消しました。' && <p className="mt-2 text-sm text-red-600">{shareError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
