'use client';

import { useEffect, useState, useCallback } from 'react';

interface TierInfo {
  tier: 'free' | 'pro' | 'unknown';
  email: string | null;
  trial_active: boolean | null;
  trial_ends_at: string | null;
}

const REVALIDATION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function useTier() {
  const [tierInfo, setTierInfo] = useState<TierInfo>({
    tier: 'unknown',
    email: null,
    trial_active: null,
    trial_ends_at: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTier = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/me');
      if (!response.ok) {
        throw new Error(`Failed to fetch tier info: ${response.statusText}`);
      }
      const data: TierInfo = await response.json();
      setTierInfo(data);
    } catch (e) {
      if (e instanceof Error) {
        setError(e);
      } else {
        setError(new Error('An unknown error occurred while fetching tier info'));
      }
      setTierInfo({ tier: 'unknown', email: null, trial_active: null, trial_ends_at: null });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  // Periodic trial revalidation (every 30 minutes)
  useEffect(() => {
    const id = setInterval(() => void fetchTier(), REVALIDATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchTier]);

  const refresh = useCallback(async () => {
    await fetchTier();
  }, [fetchTier]);

  return { ...tierInfo, isLoading, error, refresh };
}
