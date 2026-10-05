import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ViewMode } from '@/types';

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  toggle: () => void;
  isBeginner: boolean;
  isAnalyst: boolean;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ViewMode>('analyst');

  const toggle = () => setMode(mode === 'beginner' ? 'analyst' : 'beginner');

  return (
    <ViewModeContext.Provider
      value={{
        mode,
        setMode,
        toggle,
        isBeginner: mode === 'beginner',
        isAnalyst: mode === 'analyst',
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be used within ViewModeProvider');
  return ctx;
}
