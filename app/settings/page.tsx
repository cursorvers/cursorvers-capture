'use client';

import { useState, useEffect, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { idbGet, idbPut, idbClear } from '@/app/lib/idb';
import { getDeviceShort, getDeviceId } from '@/app/lib/device';
import { revokeToken } from '@/app/lib/gis'; // Assuming a revokeToken function exists for sign-out
import { Suspense } from 'react';

type ConfigFolderRecord = { key: 'folder_id'; value: string };

function SettingsContent(): JSX.Element {
  const router = useRouter();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolderId, setNewFolderId] = useState('');
  const [deviceId, setDeviceId] = useState('--------');
  const [deviceShort, setDeviceShort] = useState('--------');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const existingFolder = await idbGet<ConfigFolderRecord>('config', 'folder_id');
      if (!cancelled) {
        setFolderId(existingFolder?.value ?? null);
        setNewFolderId(existingFolder?.value ?? '');
      }
      setDeviceId(getDeviceId());
      setDeviceShort(getDeviceShort());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveFolderId = async () => {
    if (newFolderId.trim()) {
      await idbPut<ConfigFolderRecord>('config', {
        key: 'folder_id',
        value: newFolderId.trim(),
      });
      setFolderId(newFolderId.trim());
      setStatusMessage(`フォルダ ID を「${newFolderId.trim()}」に更新しました。`);
    } else {
      setStatusMessage('フォルダ ID を入力してください。');
    }
  };

  const handleSignOut = async () => {
    // Assuming revokeToken handles GIS token revocation and local cleanup
    await revokeToken();
    setStatusMessage('サインアウトしました。');
    // Optionally redirect to home or show sign-in prompt
    router.push('/');
  };

  const handleClearAllData = async () => {
    if (window.confirm('本当に全てのデータを消去しますか？（IndexedDBとLocalStorageがクリアされます）')) {
      await idbClear('config'); // Clear IndexedDB 'config' store
      await idbClear('uploadSessions'); // Clear IndexedDB for upload sessions
      await idbClear('pendingUploads'); // Clear IndexedDB for pending uploads
      localStorage.clear(); // Clear all localStorage
      setStatusMessage('全てのデータを消去しました。');
      setFolderId(null);
      setNewFolderId('');
      // Optionally reload or redirect
      router.push('/');
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">設定</h1>

      <div className="w-full flex-col gap-3 pt-2">
        {statusMessage && (
          <div
            aria-live="polite"
            className="w-full rounded-xl border border-blue-800 bg-blue-900/20 px-4 py-3 mb-4 text-left text-sm text-blue-300"
          >
            {statusMessage}
          </div>
        )}

        {/* Folder ID Input */}
        <div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-left text-xs text-neutral-400 mb-4">
          <label htmlFor="folder-id-input" className="block text-neutral-200 text-sm font-medium mb-2">
            Google Drive フォルダ ID
          </label>
          <div className="flex gap-2">
            <input
              id="folder-id-input"
              type="text"
              value={newFolderId}
              onChange={(e) => setNewFolderId(e.target.value)}
              placeholder="フォルダIDを入力"
              className="flex-grow rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-blue-500 focus:outline-none"
              aria-label="Google Drive フォルダ ID"
            />
            <button
              type="button"
              onClick={handleSaveFolderId}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
              aria-label="フォルダIDを保存"
            >
              保存
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            現在のフォルダ ID: <span className="font-mono text-neutral-300">{folderId ?? '未設定'}</span>
          </p>
        </div>

        {/* Device ID Display */}
        <div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-left text-xs text-neutral-400 mb-4">
          <p className="mb-1">
            <span className="text-neutral-500">デバイス ID:</span>{' '}
            <span className="font-mono text-neutral-200 break-all">{deviceId}</span>
          </p>
          <p>
            <span className="text-neutral-500">ショート ID:</span>{' '}
            <span className="font-mono text-neutral-200">{deviceShort}</span>
          </p>
        </div>

        {/* Sign-out button */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-neutral-900 mb-4"
          aria-label="Googleアカウントからサインアウト"
        >
          Googleアカウントからサインアウト
        </button>

        {/* Clear All Data */}
        <button
          type="button"
          onClick={handleClearAllData}
          className="w-full rounded-xl bg-neutral-700 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
          aria-label="全てのローカルデータを消去"
        >
          全てのローカルデータを消去 (IDB & localStorage)
        </button>
      </div>

      <Link href="/" className="mt-8 text-sm text-blue-400 hover:underline">
        &larr; ホームに戻る
      </Link>
    </main>
  );
}

export default function Settings(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-neutral-400 animate-pulse">
          <div className="h-8 bg-neutral-800 rounded-md w-48 mb-4"></div>
          <div className="h-4 bg-neutral-800 rounded-md w-64 mb-8"></div>
          <div className="h-12 bg-neutral-700 rounded-xl w-full mb-4"></div>
          <div className="h-24 bg-neutral-900/30 rounded-xl w-full mb-4"></div>
          <div className="h-12 bg-neutral-700 rounded-xl w-full mb-4"></div>
          <div className="h-12 bg-neutral-700 rounded-xl w-full"></div>
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
