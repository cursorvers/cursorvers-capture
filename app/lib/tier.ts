'use client';

import { useEffect, useState, useCallback } from 'react';

interface TierInfo {
  tier: 'free' | 'pro' | 'unknown';
  email: string | null;
}

export function useTier() {
  const [tierInfo, setTierInfo] = useState<TierInfo>({ tier: 'unknown', email: null });
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
      setTierInfo({ tier: 'unknown', email: null });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  const refresh = useCallback(async () => {
    await fetchTier();
  }, [fetchTier]);

  return { ...tierInfo, isLoading, error, refresh };
}
