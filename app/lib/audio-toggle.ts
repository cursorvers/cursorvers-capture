import { idbGet, idbPut } from '@/app/lib/idb';

const AUDIO_NOTE_ENABLED_KEY = 'audio_note_enabled';
const LOCAL_STORAGE_KEY = 'audio_note_enabled';

interface ConfigItem<T> {
  key: string;
  value: T;
}

function syncLocalStorage(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(LOCAL_STORAGE_KEY, enabled ? 'true' : 'false');
}

export async function getAudioEnabled(): Promise<boolean> {
  try {
    const configItem = await idbGet<ConfigItem<boolean>>(
      'config',
      AUDIO_NOTE_ENABLED_KEY,
    );
    const enabled = configItem?.value ?? false;
    syncLocalStorage(enabled);
    return enabled;
  } catch (error) {
    console.error('Error getting audio enabled state from IDB:', error);
    return false;
  }
}

export async function setAudioEnabled(enabled: boolean): Promise<void> {
  try {
    await idbPut<ConfigItem<boolean>>('config', {
      key: AUDIO_NOTE_ENABLED_KEY,
      value: enabled,
    });
    syncLocalStorage(enabled);
  } catch (error) {
    console.error('Error setting audio enabled state in IDB:', error);
  }
}
