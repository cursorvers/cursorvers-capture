import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOcrEnabled, setOcrEnabled } from '@/app/lib/ocr-toggle';
import { idbGet, idbPut } from '@/app/lib/idb';


// Mock IndexedDB
const mockConfigStore = new Map<string, any>();

vi.mock('@/app/lib/idb', () => ({
  idbGet: vi.fn(async (store: string, key: string) => {
    if (store === 'config') {
      return mockConfigStore.get(key);
    }
    return undefined;
  }),
  idbPut: vi.fn(async (store: string, value: { key: string; value: any }) => {
    if (store === 'config') {
      mockConfigStore.set(value.key, value);
    }
  }),
}));

describe('ocr-toggle', () => {
  beforeEach(() => {
    mockConfigStore.clear(); // Clear mock store before each test
    vi.clearAllMocks();
  });

  it('should return false by default if ocr_enabled is not set', async () => {
    const enabled = await getOcrEnabled();
    expect(idbGet).toHaveBeenCalledWith('config', 'ocr_enabled');
  });

  it('should set and get ocr_enabled status correctly', async () => {
    await setOcrEnabled(true);
    expect(idbPut).toHaveBeenCalledWith('config', { key: 'ocr_enabled', value: true });

    const enabled = await getOcrEnabled();
    expect(enabled).toBe(true);
    expect(idbGet).toHaveBeenCalledWith('config', 'ocr_enabled');

    await setOcrEnabled(false);
    expect(idbPut).toHaveBeenCalledWith('config', { key: 'ocr_enabled', value: false });

    const disabled = await getOcrEnabled();
    expect(disabled).toBe(false);
  });
});
