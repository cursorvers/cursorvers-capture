import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/app/lib/idb', () => ({
  idbGet: vi.fn(),
  idbPut: vi.fn(),
}));

import { getAudioEnabled, setAudioEnabled } from '@/app/lib/audio-toggle';
import { idbGet, idbPut } from '@/app/lib/idb';

describe('audio-toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false by default if audio_note_enabled is not set', async () => {
    vi.mocked(idbGet).mockResolvedValue(undefined);
    const enabled = await getAudioEnabled();
    expect(enabled).toBe(false);
    expect(idbGet).toHaveBeenCalledWith('config', 'audio_note_enabled');
  });

  it('should set and get audio_note_enabled status correctly', async () => {
    vi.mocked(idbPut).mockResolvedValue(undefined);
    vi.mocked(idbGet).mockResolvedValue({
      key: 'audio_note_enabled',
      value: true,
    });

    await setAudioEnabled(true);
    expect(idbPut).toHaveBeenCalledWith('config', {
      key: 'audio_note_enabled',
      value: true,
    });

    const enabled = await getAudioEnabled();
    expect(enabled).toBe(true);
    expect(idbGet).toHaveBeenCalledWith('config', 'audio_note_enabled');
  });
});
