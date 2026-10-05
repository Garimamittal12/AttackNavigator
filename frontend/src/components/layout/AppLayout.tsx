import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-base-950 flex">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 min-w-0">
        <TopBar onMenuClick={() => setMobileOpen(true)} onRefresh={() => setRefreshKey((v) => v + 1)} />
        <main key={refreshKey} className="p-4 sm:p-6 max-w-[1800px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
