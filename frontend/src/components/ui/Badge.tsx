import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, MinusCircle, AlertOctagon } from 'lucide-react';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending';

const variantClasses: Record<Variant, string> = {
  success: 'bg-success-500/10 text-success-400 border-success-500/30',
  warning: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
  danger: 'bg-danger-500/10 text-danger-400 border-danger-500/30',
  info: 'bg-info-500/10 text-info-400 border-info-500/30',
  neutral: 'bg-base-700 text-gray-400 border-base-600',
  pending: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
};

const variantIcons: Record<Variant, ReactNode> = {
  success: <CheckCircle2 className="w-3.5 h-3.5" />,
  warning: <AlertTriangle className="w-3.5 h-3.5" />,
  danger: <AlertOctagon className="w-3.5 h-3.5" />,
  info: <Clock className="w-3.5 h-3.5" />,
  neutral: <MinusCircle className="w-3.5 h-3.5" />,
  pending: <Clock className="w-3.5 h-3.5" />,
};

export function Badge({
  variant = 'neutral',
  children,
  icon = true,
  className = '',
}: {
  variant?: Variant;
  children: ReactNode;
  icon?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${variantClasses[variant]} ${className}`}
    >
      {icon && variantIcons[variant]}
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  children,
}: {
  status: 'success' | 'failed' | 'pending' | 'gap' | 'missed' | 'offline' | 'online' | 'partial';
  children: ReactNode;
}) {
  const map: Record<string, Variant> = {
    success: 'success',
    online: 'success',
    failed: 'danger',
    offline: 'danger',
    missed: 'danger',
    gap: 'warning',
    pending: 'pending',
    partial: 'warning',
  };
  const v = map[status] ?? 'neutral';
  const iconMap: Record<string, ReactNode> = {
    success: <CheckCircle2 className="w-3.5 h-3.5" />,
    online: <span className="w-2 h-2 rounded-full bg-success-400" />,
    failed: <XCircle className="w-3.5 h-3.5" />,
    offline: <span className="w-2 h-2 rounded-full bg-danger-400" />,
    missed: <XCircle className="w-3.5 h-3.5" />,
    gap: <AlertTriangle className="w-3.5 h-3.5" />,
    pending: <Clock className="w-3.5 h-3.5" />,
    partial: <AlertTriangle className="w-3.5 h-3.5" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${variantClasses[v]}`}
    >
      {iconMap[status]}
      {children}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, Variant> = {
    critical: 'danger',
    high: 'danger',
    medium: 'warning',
    low: 'info',
    info: 'neutral',
  };
  const v = map[severity?.toLowerCase()] ?? 'neutral';
  return <Badge variant={v}>{severity?.toUpperCase() ?? 'UNKNOWN'}</Badge>;
}
