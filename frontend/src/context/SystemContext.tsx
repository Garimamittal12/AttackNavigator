import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { systemApi } from '@/api';
import type { SystemStatus } from '@/types';

interface SystemContextValue {
  status: SystemStatus | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  refresh: () => void;
  lastChecked: Date | null;
}

const SystemContext = createContext<SystemContextValue | null>(null);

const defaultStatus: SystemStatus = {
  backend_connected: false,
  api_base_url: '',
  environment: 'unknown',
  database: 'unknown',
  detection_rules_loaded: 0,
  attack_metadata_loaded: 0,
  collector_status: 'unknown',
  agent_count: 0,
};

export function SystemProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await systemApi.status();
      setStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus({
        ...defaultStatus,
        api_base_url: 'http://localhost:8000/api',
      });
    } finally {
      setLoading(false);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const isOffline = !status?.backend_connected;

  return (
    <SystemContext.Provider value={{ status, loading, error, isOffline, refresh, lastChecked }}>
      {children}
    </SystemContext.Provider>
  );
}

export function useSystem() {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystem must be used within SystemProvider');
  return ctx;
}
