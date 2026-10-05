import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '@/api/client';

export function useApi<T>(fetcher: () => Promise<T>, enabled = true, refreshMs = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<ApiClientError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (err) {
      setError(err instanceof ApiClientError ? err : new ApiClientError('Unexpected error', 0, false));
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) return;
    load();
    const refresh = window.setInterval(() => {
      if (!document.hidden) load();
    }, refreshMs);
    return () => window.clearInterval(refresh);
  }, [enabled, load, refreshMs]);
  return { data, loading, error, reload: load };
}
