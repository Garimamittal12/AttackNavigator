import { useSystem } from '@/context/SystemContext';
import { useViewMode } from '@/context/ViewModeContext';
import { useLocation } from 'react-router-dom';
import { RefreshCw, Wifi, WifiOff, Server, Activity, HelpCircle, Menu, Search, GraduationCap, Eye } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '@/api';
import type { Scenario, Detection, AttackTechnique, RawLog, SimulationRun } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

const routeTitles: Record<string, { title: string; breadcrumb: string[] }> = {
  '/': { title: 'Dashboard', breadcrumb: ['Home'] },
  '/red-team/lab': { title: 'Red Team Lab', breadcrumb: ['Red Team', 'Lab'] },
  '/red-team/scenarios': { title: 'Scenarios', breadcrumb: ['Red Team', 'Scenarios'] },
  '/red-team/simulations': { title: 'Simulations', breadcrumb: ['Red Team', 'Simulations'] },
  '/blue-team/detections': { title: 'Detections', breadcrumb: ['Blue Team', 'Detections'] },
  '/blue-team/logs': { title: 'Logs', breadcrumb: ['Blue Team', 'Logs'] },
  '/blue-team/investigations': { title: 'Investigations', breadcrumb: ['Blue Team', 'Investigations'] },
  '/attack/matrix': { title: 'ATT&CK Matrix', breadcrumb: ['ATT&CK', 'Matrix'] },
  '/attack/coverage': { title: 'ATT&CK Coverage', breadcrumb: ['ATT&CK', 'Coverage'] },
  '/lab/agents': { title: 'Agents', breadcrumb: ['Lab', 'Agents'] },
  '/lab/infrastructure': { title: 'Infrastructure', breadcrumb: ['Lab', 'Infrastructure'] },
  '/settings': { title: 'Settings', breadcrumb: ['Settings'] },
};

export function TopBar({
  onMenuClick,
  onRefresh,
}: {
  onMenuClick: () => void;
  onRefresh: () => void;
}) {
  const { status, isOffline, refresh } = useSystem();
  const { mode, toggle } = useViewMode();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    scenarios: Scenario[];
    detections: Detection[];
    techniques: AttackTechnique[];
    hosts: { host: string; count: number }[];
    logs: RawLog[];
    simulations: SimulationRun[];
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const routeInfo = useMemo(() => {
    // Try exact match first, then prefix match
    if (routeTitles[location.pathname]) return routeTitles[location.pathname];
    for (const key of Object.keys(routeTitles)) {
      if (location.pathname.startsWith(key + '/')) return routeTitles[key];
    }
    return { title: 'AttackNavigator', breadcrumb: [] };
  }, [location.pathname]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setSearchError(false);
    try {
      const results = await searchApi.search(q);
      setSearchResults(results);
    } catch {
      setSearchError(true);
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  };

  const handleRefresh = () => {
    refresh();
    onRefresh();
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-base-900/95 backdrop-blur border-b border-base-700 flex items-center justify-between px-4 gap-4">
      {/* Left: menu + title */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick} className="md:hidden text-gray-400 hover:text-gray-200">
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-gray-100 truncate">{routeInfo.title}</h1>
          {routeInfo.breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-gray-600">
              {routeInfo.breadcrumb.map((bc, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-gray-700">/</span>}
                  <span>{bc}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: status indicators */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="btn-ghost"
          aria-label="Global search"
        >
          <Search className="w-4 h-4" />
          <span className="hidden lg:inline text-xs">Search</span>
        </button>

        {/* Backend status */}
        {isOffline ? (
          <div className="flex items-center gap-1.5 text-xs text-danger-400">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Backend Offline</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-success-400">
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Backend Connected</span>
          </div>
        )}

        {/* Agent count */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-400">
          <Server className="w-3.5 h-3.5" />
          <span>{status?.agent_count ?? 0} Agents</span>
        </div>

        {/* Collector status */}
        <div className="hidden md:flex items-center gap-1.5 text-xs">
          <Activity className={`w-3.5 h-3.5 ${
            status?.collector_status === 'online' ? 'text-success-400' :
            status?.collector_status === 'offline' ? 'text-danger-400' : 'text-gray-600'
          }`} />
          <span className={`${
            status?.collector_status === 'online' ? 'text-success-400' :
            status?.collector_status === 'offline' ? 'text-danger-400' : 'text-gray-500'
          }`}>
            Collector
          </span>
        </div>

        {/* View mode toggle */}
        <button onClick={toggle} className="btn-ghost" aria-label="Toggle view mode">
          {mode === 'beginner' ? <GraduationCap className="w-4 h-4 text-accent-400" /> : <Eye className="w-4 h-4" />}
          <span className="hidden lg:inline text-xs">
            {mode === 'beginner' ? 'Guided' : 'Standard'}
          </span>
        </button>

        {/* Refresh */}
        <button onClick={handleRefresh} className="btn-ghost" aria-label="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Help */}
        <button className="btn-ghost" aria-label="Help">
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Global Search Modal */}
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Global Search" size="lg">
        <div className="space-y-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search scenarios, detections, techniques, hosts, logs, simulations..."
            className="input-field"
            autoFocus
          />

          {searching && <p className="text-sm text-gray-500">Searching...</p>}
          {searchError && (
            <p className="text-sm text-danger-400">
              Search unavailable. Backend may be offline.
            </p>
          )}

          {searchResults && !searching && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {searchResults.scenarios.length > 0 && (
                <div>
                  <h4 className="subsection-title mb-2">Scenarios</h4>
                  {searchResults.scenarios.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => { navigate(`/red-team/scenarios`); setSearchOpen(false); }}
                      className="px-3 py-2 rounded hover:bg-base-800 cursor-pointer text-sm"
                    >
                      <span className="text-gray-200">{s.name}</span>
                      <span className="text-gray-600 ml-2 mono">{s.id}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.detections.length > 0 && (
                <div>
                  <h4 className="subsection-title mb-2">Detections</h4>
                  {searchResults.detections.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => { navigate(`/blue-team/detections/${d.id}`); setSearchOpen(false); }}
                      className="px-3 py-2 rounded hover:bg-base-800 cursor-pointer text-sm flex items-center gap-2"
                    >
                      <Badge variant="danger">{d.severity}</Badge>
                      <span className="text-gray-200">{d.rule_name}</span>
                      <span className="text-gray-600 mono">{d.attack_technique_id}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.techniques.length > 0 && (
                <div>
                  <h4 className="subsection-title mb-2">Techniques</h4>
                  {searchResults.techniques.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => { navigate(`/attack/matrix`); setSearchOpen(false); }}
                      className="px-3 py-2 rounded hover:bg-base-800 cursor-pointer text-sm"
                    >
                      <span className="mono text-accent-400">{t.id}</span>
                      <span className="text-gray-200 ml-2">{t.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.hosts.length > 0 && (
                <div>
                  <h4 className="subsection-title mb-2">Hosts</h4>
                  {searchResults.hosts.map((h) => (
                    <div key={h.host} className="px-3 py-2 rounded text-sm text-gray-300">
                      {h.host} <span className="text-gray-600">({h.count} events)</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.simulations.length > 0 && (
                <div>
                  <h4 className="subsection-title mb-2">Simulations</h4>
                  {searchResults.simulations.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => { navigate(`/red-team/simulations/${s.id}`); setSearchOpen(false); }}
                      className="px-3 py-2 rounded hover:bg-base-800 cursor-pointer text-sm"
                    >
                      <span className="text-gray-200">{s.scenario_name}</span>
                      <span className="text-gray-600 ml-2 mono">{s.id}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.scenarios.length === 0 &&
                searchResults.detections.length === 0 &&
                searchResults.techniques.length === 0 &&
                searchResults.hosts.length === 0 &&
                searchResults.logs.length === 0 &&
                searchResults.simulations.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No results found for "{searchQuery}"
                  </p>
                )}
            </div>
          )}

          {!searchResults && !searching && !searchError && searchQuery.length < 2 && (
            <p className="text-sm text-gray-600 text-center py-8">
              Type at least 2 characters to search across scenarios, detections, techniques, hosts, logs, and simulations.
            </p>
          )}
        </div>
      </Modal>
    </header>
  );
}
