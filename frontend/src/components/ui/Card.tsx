import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Card({
  children,
  className = '',
  hover = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`${hover ? 'card-hover' : 'card'} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-base-800">
      <div className="flex items-center gap-3">
        {icon && <span className="text-accent-400">{icon}</span>}
        <div>
          <h3 className="section-title">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <Loader2 className="w-6 h-6 animate-spin text-accent-400 mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      {icon && <div className="text-gray-600 mb-4">{icon}</div>}
      <h3 className="text-base font-medium text-gray-400 mb-1">{title}</h3>
      {message && <p className="text-sm text-gray-600 max-w-md">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Unable to reach AttackNavigator backend',
  message = 'Check that the FastAPI backend is running and accessible.',
  onRetry,
  isOffline,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isOffline?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="w-12 h-12 rounded-full bg-danger-500/10 border border-danger-500/30 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.3.732 3z" />
        </svg>
      </div>
      <h3 className="text-base font-medium text-danger-400 mb-1">{title}</h3>
      <p className="text-sm text-gray-600 max-w-md">{message}</p>
      {isOffline && (
        <p className="text-xs text-gray-700 mt-2 mono">Backend Offline</p>
      )}
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-4">
          Retry
        </button>
      )}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  children,
  action,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useStateHandler(defaultOpen);
  return (
    <div className="card animate-fade-in">
      <div
        className={`flex items-center justify-between px-5 py-4 border-b border-base-800 ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          <div>
            <h3 className="section-title">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

// Small helper to avoid importing useState in a component file that already has many imports
import { useState } from 'react';
function useStateHandler(initial: boolean): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(initial);
  return [open, setOpen];
}
