import { useEffect, useState } from 'react';
import api from '../api/client';

interface TierInfo {
  tier: 'free' | 'plus' | 'pro';
  trialDaysLeft: number | null;
}

let cached: TierInfo | null = null;
let fetchPromise: Promise<TierInfo> | null = null;

function fetchTier(): Promise<TierInfo> {
  if (cached) return Promise.resolve(cached);
  if (fetchPromise) return fetchPromise;
  fetchPromise = api.get('/settings')
    .then(r => {
      cached = { tier: r.data.tier || 'free', trialDaysLeft: r.data.trialDaysLeft ?? null };
      return cached;
    })
    .catch(() => ({ tier: 'free' as const, trialDaysLeft: null }))
    .finally(() => { fetchPromise = null; });
  return fetchPromise;
}

export function invalidateTierCache() {
  cached = null;
}

export default function useTier(): TierInfo & { loading: boolean } {
  const [info, setInfo] = useState<TierInfo>(cached || { tier: 'free', trialDaysLeft: null });
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    fetchTier().then(data => {
      setInfo(data);
      setLoading(false);
    });
  }, []);

  return { ...info, loading };
}
