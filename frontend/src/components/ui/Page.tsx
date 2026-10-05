import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { ErrorState, LoadingState, EmptyState } from './Card';
import type { ApiClientError } from '@/api/client';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 animate-slide-up"><div><h2 className="text-2xl font-semibold text-gray-100 tracking-tight">{title}</h2>{subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}</div>{action}</div>;
}
export function DataState({ loading, error, empty, onRetry, children }: { loading: boolean; error: ApiClientError | null; empty: boolean; onRetry: () => void; children: ReactNode }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState isOffline={error.isOffline} onRetry={onRetry} />;
  if (empty) return <EmptyState title="No data available" message="The backend has not returned any records for this view yet." icon={<RefreshCw className="w-8 h-8" />} />;
  return <>{children}</>;
}
