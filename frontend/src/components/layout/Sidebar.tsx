import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FlaskConical,
  PlayCircle,
  ListTree,
  ShieldCheck,
  Search,
  FileText,
  Grid3x3,
  BarChart3,
  Server,
  HardDrive,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: '',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    title: 'Red Team',
    items: [
      { label: 'Lab', to: '/red-team/lab', icon: FlaskConical },
      { label: 'Scenarios', to: '/red-team/scenarios', icon: ListTree },
      { label: 'Simulations', to: '/red-team/simulations', icon: PlayCircle },
    ],
  },
  {
    title: 'Blue Team',
    items: [
      { label: 'Detections', to: '/blue-team/detections', icon: ShieldCheck },
      { label: 'Logs', to: '/blue-team/logs', icon: FileText },
      { label: 'Investigations', to: '/blue-team/investigations', icon: Search },
    ],
  },
  {
    title: 'ATT&CK',
    items: [
      { label: 'Matrix', to: '/attack/matrix', icon: Grid3x3 },
      { label: 'Coverage', to: '/attack/coverage', icon: BarChart3 },
    ],
  },
  {
    title: 'Lab',
    items: [
      { label: 'Agents', to: '/lab/agents', icon: Server },
      { label: 'Infrastructure', to: '/lab/infrastructure', icon: HardDrive },
    ],
  },
  {
    title: '',
    items: [{ label: 'Settings', to: '/settings', icon: Settings }],
  },
];

export function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const width = collapsed ? 'w-16' : 'w-60';

  const content = (
    <div className={`flex flex-col h-full bg-base-900 border-r border-base-700 transition-all duration-200 ${width}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-base-700 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent-500/10 border border-accent-500/30 flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-accent-400" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-sm font-semibold text-gray-100 whitespace-nowrap">AttackNavigator</span>
            <p className="text-[10px] text-gray-600 whitespace-nowrap">Purple-Team Lab</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.title && !collapsed && (
              <p className="px-3 mb-1 text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const link = (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'sidebar-link-active' : ''} ${collapsed ? 'justify-center' : ''}`
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
                return collapsed ? (
                  <Tooltip key={item.to} content={item.label} side="right">
                    {link}
                  </Tooltip>
                ) : (
                  link
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle (desktop) */}
      <div
        className="hidden md:flex items-center justify-center py-2 border-t border-base-700"
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn-ghost"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>

      {/* Detection gap warning (if collapsed) */}
      {collapsed && (
        <div className="hidden md:flex justify-center pb-3">
          <Tooltip content="Detection gaps may exist" side="right">
            <AlertTriangle className="w-4 h-4 text-warning-500/50" />
          </Tooltip>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-screen sticky top-0">{content}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full animate-slide-in-right">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
