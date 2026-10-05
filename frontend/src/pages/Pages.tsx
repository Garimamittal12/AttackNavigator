// Dashboard, Lab, and Scenarios pages live here.
// All other pages are in Pages2.tsx.

import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BarChart3, CheckCircle2, LockKeyhole, Play,
  RefreshCw, Server, ShieldCheck, Target, WifiOff,
} from 'lucide-react';
import { agentsApi, dashboardApi, scenariosApi, simulationsApi } from '@/api';
import { ApiClientError } from '@/api/client';
import { useSystem } from '@/context/SystemContext';
import { useViewMode } from '@/context/ViewModeContext';
import { useApi } from '@/hooks/useApi';
import type { Scenario } from '@/types';
import {
  Badge, SeverityBadge, StatusBadge,
  Card, CardBody, CardHeader, DataState, EmptyState,
  Table, Modal, Drawer, PageHeader,
} from '@/components/ui';

function useStableApi<T>(fetcher: () => Promise<T>) {
  const stable = useCallback(fetcher, []);
  return useApi(stable);
}
function shortDate(v: string | null | undefined) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function statusVariant(s: string): 'success' | 'failed' | 'pending' | 'gap' | 'missed' | 'offline' | 'online' | 'partial' {
  if (['success', 'completed', 'detected', 'received', 'online'].includes(s)) return 'success';
  if (['failed', 'missed', 'offline'].includes(s)) return 'failed';
  if (s === 'partial') return 'partial';
  if (['mismatch', 'gap'].includes(s)) return 'gap';
  return 'pending';
}

export function DashboardPage() {
  const stats = useStableApi(dashboardApi.stats);
  const sims = useStableApi(() => dashboardApi.recentSimulations(8));
  const detections = useStableApi(() => dashboardApi.recentDetections(8));
  const gaps = useStableApi(dashboardApi.detectionGaps);
  const navigate = useNavigate();
  const { isOffline } = useSystem();
  const metrics = [
    ['Connected Agents', stats.data?.connected_agents, Server, 'text-success-400'],
    ['Simulation Runs', stats.data?.simulation_runs, Play, 'text-accent-400'],
    ['Detections', stats.data?.detections, ShieldCheck, 'text-warning-400'],
    ['Detection Gaps', stats.data?.detection_gaps, AlertTriangle, 'text-danger-400'],
    ['Techniques Tested', stats.data?.techniques_tested, Target, 'text-info-400'],
    ['Techniques Detected', stats.data?.techniques_detected, CheckCircle2, 'text-success-400'],
  ] as const;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Controlled purple-team validation at a glance"
        action={<button className="btn-secondary" onClick={() => { stats.reload(); sims.reload(); detections.reload(); gaps.reload(); }}><RefreshCw className="w-4 h-4" /> Refresh data</button>}
      />
      {isOffline && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-danger-500/30 bg-danger-500/5 flex items-start gap-3">
          <WifiOff className="w-4 h-4 text-danger-400 mt-0.5" />
          <div>
            <p className="text-sm text-danger-300">Backend offline</p>
            <p className="text-xs text-gray-500 mt-1">The dashboard is waiting for real FastAPI data. No sample telemetry or statistics are shown.</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {metrics.map(([label, value, Icon, color]) => (
          <Card key={label}>
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">{label}</span>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-2xl font-semibold text-gray-100">{value ?? '—'}</p>
            </CardBody>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Recent simulations" subtitle="Backend-recorded scenario runs" action={<Link to="/red-team/simulations" className="btn-ghost">View all <ArrowRight className="w-3.5 h-3.5" /></Link>} />
          <DataState loading={sims.loading} error={sims.error} empty={!sims.data?.length} onRetry={sims.reload}>
            <Table
              data={sims.data ?? []}
              onRowClick={(r) => navigate(`/red-team/simulations/${r.id}`)}
              columns={[
                { key: 'created_at', header: 'Time', render: (r) => shortDate(r.created_at) },
                { key: 'scenario_name', header: 'Scenario' },
                { key: 'target_hostname', header: 'Target' },
                { key: 'status', header: 'Simulation', render: (r) => <StatusBadge status={statusVariant(r.status)}>{r.status}</StatusBadge> },
                { key: 'detection_status', header: 'Detection', render: (r) => <StatusBadge status={statusVariant(r.detection_status)}>{r.detection_status}</StatusBadge> },
                { key: 'attack_technique_id', header: 'ATT&CK', render: (r) => <span className="mono text-accent-400">{r.attack_technique_id ?? '—'}</span>, hideOnMobile: true },
              ]}
              emptyState={<EmptyState title="No simulations have been executed" message="Run a controlled scenario from Red Team Lab to begin." />}
            />
          </DataState>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Recent detections" subtitle="Stored rule matches" action={<Link to="/blue-team/detections" className="btn-ghost">View all <ArrowRight className="w-3.5 h-3.5" /></Link>} />
          <DataState loading={detections.loading} error={detections.error} empty={!detections.data?.length} onRetry={detections.reload}>
            <div className="divide-y divide-base-800">
              {detections.data?.map((d) => (
                <button key={d.id} className="w-full text-left px-5 py-3 hover:bg-base-800/60 transition-colors" onClick={() => navigate(`/blue-team/detections/${d.id}`)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-200 truncate">{d.rule_name}</span>
                    <SeverityBadge severity={d.severity} />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                    <span>{d.host}</span>
                    <span className="mono text-accent-400">{d.attack_technique_id}</span>
                  </div>
                </button>
              ))}
            </div>
          </DataState>
        </Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
        <Card>
          <CardHeader title="ATT&CK coverage summary" subtitle="Only tested backend results" />
          <DataState loading={stats.loading} error={stats.error} empty={!stats.data} onRetry={stats.reload}>
            {stats.data && (
              <CardBody>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-3xl font-semibold text-gray-100">{stats.data.techniques_detected} <span className="text-sm text-gray-500 font-normal">detected</span></p>
                    <p className="text-xs text-gray-500 mt-1">of {stats.data.techniques_tested} techniques tested</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-accent-400" />
                </div>
                <div className="h-2 rounded bg-base-700 overflow-hidden">
                  <div className="h-full bg-success-500 transition-all" style={{ width: stats.data.techniques_tested ? `${Math.min(100, stats.data.techniques_detected / stats.data.techniques_tested * 100)}%` : '0%' }} />
                </div>
                <p className="text-xs text-gray-600 mt-3">An empty result means no techniques have been tested yet, not complete coverage.</p>
              </CardBody>
            )}
          </DataState>
        </Card>
        <Card>
          <CardHeader title="Detection gaps" subtitle="Telemetry received but expected detection was not generated" />
          <DataState loading={gaps.loading} error={gaps.error} empty={!gaps.data?.length} onRetry={gaps.reload}>
            <div className="divide-y divide-base-800">
              {gaps.data?.slice(0, 5).map((g) => (
                <button key={g.id} className="w-full text-left p-4 hover:bg-base-800/60" onClick={() => navigate(`/red-team/simulations/${g.simulation_id}`)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">{g.scenario_name}</span>
                    <Badge variant="warning">Detection gap</Badge>
                  </div>
                  <p className="text-xs mono text-accent-400 mt-1">Expected {g.expected_technique_id} · {g.telemetry_status}</p>
                </button>
              ))}
            </div>
          </DataState>
        </Card>
      </div>
    </div>
  );
}

export function LabPage() {
  const agents = useStableApi(agentsApi.list);
  const scenarios = useStableApi(scenariosApi.list);
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [runError, setRunError] = useState('');
  const [running, setRunning] = useState(false);
  const navigate = useNavigate();
  const { isBeginner } = useViewMode();
  const online = agents.data?.filter((a) => a.status === 'online') ?? [];
  const grouped = useMemo(() => {
    const result: Record<string, Scenario[]> = {};
    for (const s of scenarios.data ?? []) (result[s.tactic] ??= []).push(s);
    return result;
  }, [scenarios.data]);

  const runScenario = async () => {
    if (!selected || !target) return;
    setRunning(true);
    setRunError('');
    try {
      const run = await simulationsApi.run({ scenario_id: selected.id, target_agent_id: target });
      navigate(`/red-team/simulations/${run.id}`);
    } catch (err) {
      setRunError(err instanceof ApiClientError ? err.detail : 'Unable to start scenario');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader title="Red Team Lab" subtitle="Run controlled, predefined security scenarios against isolated lab systems." />
      <div className="mb-6 px-4 py-3 rounded-lg bg-warning-500/5 border border-warning-500/25 flex items-start gap-3">
        <LockKeyhole className="w-4 h-4 text-warning-400 mt-0.5" />
        <div>
          <p className="text-sm text-warning-300">Controlled execution only</p>
          <p className="text-xs text-gray-500 mt-1">Only predefined scenario IDs are supported. AttackNavigator does not provide arbitrary command execution.</p>
        </div>
      </div>
      <Card className="mb-6">
        <CardHeader title="Lab status" subtitle="Actual agent heartbeats and collector state" />
        <DataState loading={agents.loading} error={agents.error} empty={!agents.data?.length} onRetry={agents.reload}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 p-4">
            {agents.data?.map((a) => (
              <div key={a.id} className="text-left p-4 rounded-md bg-base-900 border border-base-700 hover:border-base-600 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{a.hostname}</p>
                    <p className="text-xs text-gray-500 mt-1">{a.os}</p>
                  </div>
                  <StatusBadge status={statusVariant(a.status)}>{a.status}</StatusBadge>
                </div>
                <div className="text-xs text-gray-600 mt-4 space-y-1">
                  <p>{a.ip || 'IP unavailable'}</p>
                  <p>Heartbeat: {shortDate(a.last_heartbeat)}</p>
                  <p>Version: {a.version || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </DataState>
      </Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">Scenario browser</h3>
          <p className="text-xs text-gray-500 mt-1">Select a backend-provided scenario to view its expected evidence.</p>
        </div>
        <span className="text-xs text-gray-600">{scenarios.data?.length ?? 0} available</span>
      </div>
      <DataState loading={scenarios.loading} error={scenarios.error} empty={!scenarios.data?.length} onRetry={scenarios.reload}>
        <div className="space-y-5">
          {Object.entries(grouped).map(([tactic, items]) => (
            <div key={tactic}>
              <p className="subsection-title mb-2">{tactic}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map((s) => (
                  <Card key={s.id} hover onClick={() => setSelected(s)}>
                    <CardBody>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-gray-200">{s.name}</h4>
                        <Badge variant={s.status === 'implemented' ? 'success' : 'neutral'}>{s.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{s.description}</p>
                      <div className="flex items-center gap-2 mt-4">
                        <span className="mono text-xs text-accent-400">{s.technique_id || 'No technique'}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-xs text-gray-500">{s.platform}</span>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DataState>
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? 'Scenario details'}>
        {selected && (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-gray-300">{selected.description}</p>
              <div className="flex gap-2 mt-3">
                <Badge variant="info">{selected.tactic}</Badge>
                <Badge variant="neutral">{selected.platform}</Badge>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-gray-600">Scenario ID</dt><dd className="mono text-gray-300 mt-1">{selected.id}</dd></div>
              <div><dt className="text-xs text-gray-600">Target</dt><dd className="text-gray-300 mt-1">{selected.target || 'Backend selected'}</dd></div>
              <div><dt className="text-xs text-gray-600">Expected telemetry</dt><dd className="text-gray-300 mt-1">{selected.expected_telemetry || '—'}</dd></div>
              <div><dt className="text-xs text-gray-600">Expected event</dt><dd className="text-gray-300 mt-1">{selected.expected_event || '—'}</dd></div>
              <div><dt className="text-xs text-gray-600">ATT&CK</dt><dd className="mono text-accent-400 mt-1">{selected.technique_id || '—'}</dd></div>
              <div><dt className="text-xs text-gray-600">Detection rule</dt><dd className="mono text-gray-300 mt-1">{selected.detection_rule_id || selected.expected_detection_rule || '—'}</dd></div>
            </dl>
            {isBeginner && (
              <div className="p-3 rounded-md bg-accent-500/5 border border-accent-500/20 text-xs text-gray-400">
                This scenario runs a predefined activity on a lab target, then the backend checks whether real telemetry and a real detection are produced.
              </div>
            )}
            <button className="btn-primary w-full justify-center" disabled={!online.length} onClick={() => { setTarget(online[0]?.id ?? ''); setRunOpen(true); }}>
              {online.length ? <><Play className="w-4 h-4" /> Run scenario</> : <><WifiOff className="w-4 h-4" /> No online target</>}
            </button>
          </div>
        )}
      </Drawer>
      <Modal open={runOpen} onClose={() => setRunOpen(false)} title="Run controlled scenario" footer={<><button className="btn-secondary" onClick={() => setRunOpen(false)}>Cancel</button><button className="btn-primary" disabled={!target || running} onClick={runScenario}>{running ? 'Starting...' : 'Run scenario'}</button></>}>
        {selected && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">This action executes a predefined scenario on the isolated lab machine. No arbitrary commands are accepted.</p>
            <div className="p-3 rounded bg-base-900 border border-base-700">
              <p className="text-sm text-gray-200">{selected.name}</p>
              <p className="text-xs mono text-accent-400 mt-1">{selected.id}</p>
            </div>
            <label className="block">
              <span className="text-xs text-gray-500">Target agent</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="input-field mt-1">
                {online.map((a) => <option key={a.id} value={a.id}>{a.hostname} · {a.os}</option>)}
              </select>
            </label>
            {runError && <p className="text-sm text-danger-400">{runError}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function ScenariosPage() {
  return <LabPage />;
}
