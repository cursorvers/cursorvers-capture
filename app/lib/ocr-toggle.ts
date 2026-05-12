import { idbGet, idbPut } from './idb';

const OCR_ENABLED_KEY = 'ocr_enabled';
const CONFIG_STORE = 'config';

export async function getOcrEnabled(): Promise<boolean> {
  try {
    const config = await idbGet<{ key: string; value: boolean }>(CONFIG_STORE, OCR_ENABLED_KEY);
    return config?.value ?? false;
  } catch (error) {
    console.error('Error getting OCR enabled status from IndexedDB:', error);
    return false; // Default to false on error
  }
}

export async function setOcrEnabled(value: boolean): Promise<void> {
  try {
    await idbPut(CONFIG_STORE, { key: OCR_ENABLED_KEY, value });
  } catch (error) {
    console.error('Error setting OCR enabled status to IndexedDB:', error);
  }
}
