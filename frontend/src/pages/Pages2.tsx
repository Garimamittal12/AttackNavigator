import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, ChevronDown, ChevronRight, Clipboard,
  CloudUpload, FileCode2, FileText, Info,
  Network, Play, RefreshCw, Server, ShieldAlert, ShieldCheck,
  Target, Terminal, Upload, XCircle, Zap,
} from 'lucide-react';
import {
  agentsApi, attackApi, dashboardApi, detectionsApi, logsApi, rulesApi,
  simulationsApi, uploadApi,
} from '@/api';
import { ApiClientError, API_BASE_URL } from '@/api/client';
import { useSystem } from '@/context/SystemContext';
import { useViewMode } from '@/context/ViewModeContext';
import { useApi } from '@/hooks/useApi';
import type {
  Agent, AttackTechnique,
  DetectionRule, NormalizedEvent, RawLog, UploadResult,
} from '@/types';
import {
  Badge, SeverityBadge, StatusBadge,
  Card, CardBody, CardHeader, DataState, EmptyState, LoadingState,
  Table, Drawer,
  Pipeline, HorizontalPipeline, type PipelineStep,
  PageHeader,
} from '@/components/ui';

// ── helpers ──

function useStableApi<T>(fetcher: () => Promise<T>) {
  const stable = useCallback(fetcher, []);
  return useApi(stable);
}

function shortDate(v: string | null | undefined) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fullDate(v: string | null | undefined) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}
function timeOnly(v: string | null | undefined) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function statusVariant(s: string): 'success' | 'failed' | 'pending' | 'gap' | 'missed' | 'offline' | 'online' | 'partial' {
  if (['success', 'completed', 'detected', 'received', 'online'].includes(s)) return 'success';
  if (['failed', 'missed', 'offline'].includes(s)) return 'failed';
  if (s === 'partial') return 'partial';
  if (['mismatch', 'gap'].includes(s)) return 'gap';
  return 'pending';
}
function stageStatus(s: string): PipelineStep['status'] {
  if (['success', 'completed', 'detected', 'received'].includes(s)) return 'completed';
  if (['failed', 'missed'].includes(s)) return 'failed';
  if (['running', 'in_progress', 'pending'].includes(s)) return 'in_progress';
  if (['skipped'].includes(s)) return 'skipped';
  return 'pending';
}

// ── Collapsible ──
function Collapsible({ title, subtitle, children, defaultOpen = true, icon }: {
  title: string; subtitle?: string; children: ReactNode; defaultOpen?: boolean; icon?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button className="w-full flex items-center justify-between px-5 py-4" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          {icon && <span className="text-accent-400">{icon}</span>}
          <div className="text-left">
            <h3 className="section-title">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-5 py-4 border-t border-base-800">{children}</div>}
    </Card>
  );
}

// ── KeyValue grid ──
function KV({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-gray-600">{label}</dt>
      <dd className={`text-sm text-gray-300 mt-1 ${mono ? 'mono' : ''}`}>{value ?? '—'}</dd>
    </div>
  );
}

// ════════════════════════════════════════
// SIMULATIONS LIST
// ════════════════════════════════════════
export function SimulationsPage() {
  const api = useStableApi(() => simulationsApi.list({ page: 1, page_size: 50 }));
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Simulations" subtitle="History of controlled scenario runs and their pipeline results." />
      <Card>
        <DataState loading={api.loading} error={api.error} empty={!api.data?.items?.length} onRetry={api.reload}>
          <Table
            data={api.data?.items ?? []}
            onRowClick={(r) => navigate(`/red-team/simulations/${r.id}`)}
            columns={[
              { key: 'created_at', header: 'Time', render: (r) => shortDate(r.created_at) },
              { key: 'scenario_name', header: 'Scenario' },
              { key: 'target_hostname', header: 'Target', hideOnMobile: true },
              { key: 'status', header: 'Simulation', render: (r) => <StatusBadge status={statusVariant(r.status)}>{r.status}</StatusBadge> },
              { key: 'telemetry_status', header: 'Telemetry', render: (r) => <StatusBadge status={statusVariant(r.telemetry_status)}>{r.telemetry_status}</StatusBadge>, hideOnMobile: true },
              { key: 'detection_status', header: 'Detection', render: (r) => <StatusBadge status={statusVariant(r.detection_status)}>{r.detection_status}</StatusBadge> },
              { key: 'attack_technique_id', header: 'ATT&CK', render: (r) => <span className="mono text-accent-400">{r.attack_technique_id ?? '—'}</span>, hideOnMobile: true },
            ]}
            emptyState={<EmptyState title="No simulations have been executed" message="Run a controlled scenario from Red Team Lab to see results here." icon={<Play className="w-8 h-8" />} />}
          />
        </DataState>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════
// SIMULATION DETAIL
// ════════════════════════════════════════
export function SimulationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useStableApi(() => simulationsApi.get(id!));
  const { isBeginner } = useViewMode();
  const navigate = useNavigate();

  const sim = api.data;
  const steps: PipelineStep[] = sim ? [
    { label: 'Scenario validated', status: 'completed' },
    { label: 'Target validated', status: 'completed' },
    { label: 'Agent execution', status: stageStatus(sim.status) },
    { label: 'Telemetry', status: stageStatus(sim.telemetry_status) },
    { label: 'Parsing', status: sim.parsing_status },
    { label: 'Normalization', status: sim.parsing_status === 'completed' ? 'completed' : 'pending' },
    { label: 'Detection', status: stageStatus(sim.detection_status) },
    { label: 'ATT&CK mapping', status: sim.attack_technique_id ? 'completed' : 'pending' },
  ] : [];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link to="/red-team/simulations" className="text-gray-500 hover:text-gray-300">Simulations</Link>
        <ChevronRight className="w-4 h-4 text-gray-700" />
        <span className="text-gray-300">{sim?.scenario_name ?? 'Loading...'}</span>
      </div>
      <PageHeader
        title={sim?.scenario_name ?? 'Simulation'}
        subtitle={sim ? `${sim.scenario_id} · Target: ${sim.target_hostname}` : undefined}
        action={<button className="btn-secondary" onClick={api.reload}><RefreshCw className="w-4 h-4" /> Refresh</button>}
      />
      <DataState loading={api.loading} error={api.error} empty={!sim} onRetry={api.reload}>
        {sim && (
          <div className="space-y-5">
            {/* Pipeline */}
            <Card>
              <CardHeader title="Scenario execution" subtitle="Each stage reflects actual backend state" />
              <CardBody><Pipeline steps={steps} /></CardBody>
            </Card>

            {/* Status grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                ['Simulation', sim.status, statusVariant(sim.status)],
                ['Telemetry', sim.telemetry_status, statusVariant(sim.telemetry_status)],
                ['Parsing', sim.parsing_status, statusVariant(sim.parsing_status)],
                ['Detection', sim.detection_status, statusVariant(sim.detection_status)],
                ['ATT&CK', sim.attack_technique_id ? 'Mapped' : 'Pending', sim.attack_technique_id ? 'success' : 'pending'],
                ['Severity', sim.severity ?? '—', 'neutral'],
              ].map(([label, val, variant]) => (
                <Card key={label as string}>
                  <CardBody className="p-3">
                    <p className="text-xs text-gray-500 mb-1">{label as string}</p>
                    {label === 'Severity' ? <SeverityBadge severity={val as string} /> : <StatusBadge status={variant as 'success'}>{val as string}</StatusBadge>}
                  </CardBody>
                </Card>
              ))}
            </div>

            {/* Detection gap / telemetry gap warnings */}
            {sim.detection_status === 'missed' && (
              <div className="px-4 py-3 rounded-lg border border-warning-500/30 bg-warning-500/5 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-warning-400 mt-0.5" />
                <div><p className="text-sm text-warning-300">Detection gap</p><p className="text-xs text-gray-500 mt-1">The scenario generated telemetry, but no configured detection rule matched the resulting normalized event.</p></div>
              </div>
            )}
            {sim.telemetry_status === 'failed' && (
              <div className="px-4 py-3 rounded-lg border border-danger-500/30 bg-danger-500/5 flex items-start gap-3">
                <XCircle className="w-4 h-4 text-danger-400 mt-0.5" />
                <div><p className="text-sm text-danger-300">Telemetry gap</p><p className="text-xs text-gray-500 mt-1">The scenario executed but expected telemetry was not received from the target agent.</p></div>
              </div>
            )}

            {/* Expected vs Actual */}
            <Card>
              <CardHeader title="Expected vs actual" subtitle="Comparison of what the scenario expected versus what the backend recorded" />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-md bg-base-900 border border-base-700">
                    <p className="subsection-title mb-3">Expected</p>
                    <dl className="space-y-2">
                      <KV label="Telemetry" value={sim.expected.telemetry} />
                      <KV label="Event type" value={sim.expected.event_type} />
                      <KV label="ATT&CK" value={sim.expected.attack_technique_id} mono />
                      <KV label="Detection rule" value={sim.expected.detection_rule_id} mono />
                      <KV label="Tactic" value={sim.expected.tactic} />
                      <KV label="Severity" value={<SeverityBadge severity={sim.expected.severity} />} />
                    </dl>
                  </div>
                  <div className="p-4 rounded-md bg-base-900 border border-base-700">
                    <p className="subsection-title mb-3">Actual</p>
                    {sim.actual ? (
                      <dl className="space-y-2">
                        <KV label="Telemetry" value={sim.actual.telemetry ?? '—'} />
                        <KV label="Event type" value={sim.actual.event_type ?? '—'} />
                        <KV label="ATT&CK" value={sim.actual.attack_technique_id ?? '—'} mono />
                        <KV label="Detection rule" value={sim.actual.detection_rule_id ?? '—'} mono />
                        <KV label="Detection ID" value={sim.actual.detection_id ?? '—'} mono />
                        <div className="pt-2">
                          {sim.actual.match === 'match' ? <Badge variant="success">Match</Badge> : sim.actual.match === 'mismatch' ? <Badge variant="danger">Mismatch</Badge> : <Badge variant="warning">Partial</Badge>}
                        </div>
                      </dl>
                    ) : <p className="text-sm text-gray-600">No actual results recorded yet.</p>}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Timeline */}
            {sim.timeline?.length > 0 && (
              <Card>
                <CardHeader title="Simulation timeline" subtitle="Actual timestamps from the backend" />
                <CardBody>
                  <div className="space-y-3">
                    {sim.timeline.map((t, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="mono text-xs text-gray-600 mt-0.5 w-20 flex-shrink-0">{timeOnly(t.timestamp)}</span>
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${t.status === 'completed' ? 'bg-success-400' : t.status === 'failed' ? 'bg-danger-400' : t.status === 'in_progress' ? 'bg-accent-400' : 'bg-gray-700'}`} />
                        <div>
                          <p className="text-sm text-gray-300">{t.stage}</p>
                          {t.message && <p className="text-xs text-gray-600 mt-0.5">{t.message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Related detections */}
            {sim.detection_ids?.length > 0 && (
              <Card>
                <CardHeader title="Related detections" action={<Link to="/blue-team/detections" className="btn-ghost">View all <ArrowRight className="w-3.5 h-3.5" /></Link>} />
                <CardBody>
                  <div className="space-y-2">
                    {sim.detection_ids.map((did) => (
                      <button key={did} className="w-full text-left px-3 py-2 rounded bg-base-900 border border-base-700 hover:border-base-600 text-sm" onClick={() => navigate(`/blue-team/detections/${did}`)}>
                        <span className="mono text-accent-400">{did}</span>
                      </button>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Beginner explanation */}
            {isBeginner && (
              <Card>
                <CardHeader title="What happened?" icon={<Info className="w-4 h-4" />} />
                <CardBody>
                  <div className="space-y-3 text-sm text-gray-400">
                    <p>A controlled scenario (<span className="mono text-accent-400">{sim.scenario_id}</span>) was executed on <span className="text-gray-200">{sim.target_hostname}</span>.</p>
                    <p>The backend recorded the simulation as <StatusBadge status={statusVariant(sim.status)}>{sim.status}</StatusBadge>, telemetry as <StatusBadge status={statusVariant(sim.telemetry_status)}>{sim.telemetry_status}</StatusBadge>, and detection as <StatusBadge status={statusVariant(sim.detection_status)}>{sim.detection_status}</StatusBadge>.</p>
                    {sim.attack_technique_id && <p>The activity was mapped to ATT&CK technique <span className="mono text-accent-400">{sim.attack_technique_id}</span> ({sim.attack_technique_name}).</p>}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}

// ════════════════════════════════════════
// DETECTIONS LIST
// ════════════════════════════════════════
export function DetectionsPage() {
  const [filters, setFilters] = useState<{ severity?: string; platform?: string; host?: string; tactic?: string }>({});
  const api = useStableApi(() => detectionsApi.list(filters));
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Detections" subtitle="Stored rule matches generated by the detection engine." />
      <Card className="mb-4">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select className="input-field" value={filters.severity ?? ''} onChange={(e) => setFilters({ ...filters, severity: e.target.value || undefined })}>
              <option value="">All severities</option>
              <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="info">Info</option>
            </select>
            <select className="input-field" value={filters.platform ?? ''} onChange={(e) => setFilters({ ...filters, platform: e.target.value || undefined })}>
              <option value="">All platforms</option><option value="windows">Windows</option><option value="linux">Linux</option>
            </select>
            <input className="input-field" placeholder="Filter by host" value={filters.host ?? ''} onChange={(e) => setFilters({ ...filters, host: e.target.value || undefined })} />
            <input className="input-field" placeholder="Filter by tactic" value={filters.tactic ?? ''} onChange={(e) => setFilters({ ...filters, tactic: e.target.value || undefined })} />
          </div>
        </CardBody>
      </Card>
      <Card>
        <DataState loading={api.loading} error={api.error} empty={!api.data?.items?.length} onRetry={api.reload}>
          <Table
            data={api.data?.items ?? []}
            onRowClick={(d) => navigate(`/blue-team/detections/${d.id}`)}
            columns={[
              { key: 'severity', header: 'Severity', render: (d) => <SeverityBadge severity={d.severity} /> },
              { key: 'rule_name', header: 'Detection' },
              { key: 'host', header: 'Host', hideOnMobile: true },
              { key: 'platform', header: 'Platform', hideOnMobile: true },
              { key: 'attack_technique_id', header: 'ATT&CK', render: (d) => <span className="mono text-accent-400">{d.attack_technique_id}</span> },
              { key: 'tactic', header: 'Tactic', hideOnMobile: true },
              { key: 'timestamp', header: 'Timestamp', render: (d) => shortDate(d.timestamp) },
            ]}
            emptyState={<EmptyState title="No detections" message="No stored detection events are currently available." icon={<ShieldCheck className="w-8 h-8" />} />}
          />
        </DataState>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════
// DETECTION DETAIL / INVESTIGATION
// ════════════════════════════════════════
export function DetectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useStableApi(() => detectionsApi.get(id!));
  const ruleApi = useStableApi<DetectionRule | null>(() => api.data ? rulesApi.get(api.data.rule_id) : Promise.resolve(null));
  const rawApi = useStableApi<RawLog | null>(() => api.data?.raw_log_id ? logsApi.get(api.data.raw_log_id) : Promise.resolve(null));
  const normApi = useStableApi<NormalizedEvent | null>(() => api.data?.normalized_event_id ? logsApi.normalized(api.data.normalized_event_id) : Promise.resolve(null));
  const { isBeginner } = useViewMode();
  const [showJson, setShowJson] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const navigate = useNavigate();
  const det = api.data;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link to="/blue-team/detections" className="text-gray-500 hover:text-gray-300">Detections</Link>
        <ChevronRight className="w-4 h-4 text-gray-700" />
        <span className="text-gray-300">{det?.rule_name ?? 'Loading...'}</span>
      </div>
      <PageHeader title={det?.rule_name ?? 'Detection'} subtitle={det ? `${det.rule_id} · ${det.host}` : undefined} action={<button className="btn-secondary" onClick={api.reload}><RefreshCw className="w-4 h-4" /> Refresh</button>} />
      <DataState loading={api.loading} error={api.error} empty={!det} onRetry={api.reload}>
        {det && (
          <div className="space-y-5">
            {/* Header card */}
            <Card>
              <CardBody>
                <div className="flex flex-wrap items-center gap-3">
                  <SeverityBadge severity={det.severity} />
                  <span className="mono text-accent-400 text-sm">{det.attack_technique_id}</span>
                  <span className="text-sm text-gray-400">{det.attack_technique_name}</span>
                  <Badge variant="info">{det.tactic}</Badge>
                </div>
              </CardBody>
            </Card>

            {/* Summary */}
            <Collapsible title="Detection summary" icon={<Info className="w-4 h-4" />}>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KV label="Detection ID" value={det.id} mono />
                <KV label="Rule ID" value={det.rule_id} mono />
                <KV label="Host" value={det.host} />
                <KV label="Platform" value={det.platform} />
                <KV label="Timestamp" value={fullDate(det.timestamp)} />
                <KV label="Severity" value={<SeverityBadge severity={det.severity} />} />
                <KV label="Scenario" value={det.scenario_name ?? '—'} />
                <KV label="Simulation" value={det.simulation_id ? <button className="mono text-accent-400 hover:underline" onClick={() => navigate(`/red-team/simulations/${det.simulation_id}`)}>{det.simulation_id}</button> : '—'} />
              </dl>
            </Collapsible>

            {/* Why detected */}
            <Collapsible title="Why was this detected?" subtitle="The detection rule matched the following normalized event fields" icon={<Zap className="w-4 h-4" />}>
              {(det.matched_fields?.length ?? 0) > 0 ? (
                <div className="space-y-3">
                  {det.matched_fields.map((mf, i) => (
                    <div key={i} className="p-3 rounded bg-base-900 border border-base-700">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-300 mono">{mf.field}</span>
                        <span className="text-gray-600">{mf.operator}</span>
                        <span className="text-accent-400 mono">{mf.expected}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        <span className="text-gray-600">Actual:</span>
                        <span className="text-gray-300 mono">{mf.actual}</span>
                      </div>
                    </div>
                  ))}
                  {isBeginner && (
                    <div className="p-3 rounded-md bg-accent-500/5 border border-accent-500/20 text-xs text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">How this works:</p>
                      <p>Raw log → Parsed event → Normalized field → Rule condition → Detection → ATT&CK technique</p>
                      <p className="mt-2">The detection rule checked a field in the normalized event, and it matched. That match is why this detection was generated.</p>
                    </div>
                  )}
                </div>
              ) : <p className="text-sm text-gray-600">No matched field details available from the backend.</p>}
            </Collapsible>

            {/* Normalized event */}
            {normApi.data && (
              <Collapsible title="Normalized event" subtitle="Key-value view of the parsed event" icon={<FileCode2 className="w-4 h-4" />} defaultOpen={false}>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <KV label="Timestamp" value={fullDate((normApi.data as NormalizedEvent).timestamp)} />
                  <KV label="Host" value={(normApi.data as NormalizedEvent).host} />
                  <KV label="Platform" value={(normApi.data as NormalizedEvent).platform} />
                  <KV label="Source" value={(normApi.data as NormalizedEvent).source} />
                  <KV label="Event type" value={(normApi.data as NormalizedEvent).event_type} />
                  <KV label="Event ID" value={(normApi.data as NormalizedEvent).event_id} mono />
                </dl>
                {(normApi.data as NormalizedEvent).fields && (
                  <div className="space-y-1">
                    {Object.entries((normApi.data as NormalizedEvent).fields).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 px-3 py-1.5 rounded bg-base-900 border border-base-800 text-sm">
                        <span className="text-gray-500 w-40 flex-shrink-0">{k}</span>
                        <span className="text-gray-300 mono truncate">{String(v ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn-ghost mt-3" onClick={() => setShowJson(!showJson)}>{showJson ? 'Hide JSON' : 'View JSON'}</button>
                {showJson && <pre className="mt-2 p-3 rounded bg-base-950 border border-base-700 mono text-xs text-gray-400 overflow-x-auto">{JSON.stringify(normApi.data, null, 2)}</pre>}
              </Collapsible>
            )}

            {/* Raw telemetry */}
            {rawApi.data && (
              <Collapsible title="Raw telemetry" subtitle={`Source: ${(rawApi.data as RawLog).source} · Event ID: ${(rawApi.data as RawLog).event_id}`} icon={<Terminal className="w-4 h-4" />} defaultOpen={false}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-600">RAW TELEMETRY</span>
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={() => { navigator.clipboard?.writeText((rawApi.data as RawLog).raw_data ?? ''); }}><Clipboard className="w-3.5 h-3.5" /> Copy</button>
                    <button className="btn-ghost" onClick={() => setShowRaw(!showRaw)}>{showRaw ? 'Collapse' : 'Expand'}</button>
                  </div>
                </div>
                <pre className={`p-3 rounded bg-base-950 border border-base-700 mono text-xs text-gray-400 overflow-x-auto ${showRaw ? '' : 'max-h-48'}`}>{(rawApi.data as RawLog).raw_data ?? 'No raw data available'}</pre>
              </Collapsible>
            )}

            {/* Detection rule */}
            {ruleApi.data && (
              <Collapsible title="Detection rule" subtitle="YAML detection rule from the backend" icon={<FileText className="w-4 h-4" />} defaultOpen={false}>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <KV label="Rule ID" value={(ruleApi.data as DetectionRule).id} mono />
                  <KV label="Name" value={(ruleApi.data as DetectionRule).name} />
                  <KV label="Severity" value={<SeverityBadge severity={(ruleApi.data as DetectionRule).severity} />} />
                  <KV label="ATT&CK" value={(ruleApi.data as DetectionRule).attack_technique_id} mono />
                  <KV label="Tactic" value={(ruleApi.data as DetectionRule).tactic} />
                  <KV label="Enabled" value={(ruleApi.data as DetectionRule).enabled ? 'Yes' : 'No'} />
                </dl>
                <p className="text-xs text-gray-500 mb-2">{(ruleApi.data as DetectionRule).description}</p>
                <pre className="p-3 rounded bg-base-950 border border-base-700 mono text-xs text-gray-400 overflow-x-auto">{(ruleApi.data as DetectionRule).yaml}</pre>
              </Collapsible>
            )}

            {/* ATT&CK panel */}
            <Collapsible title="ATT&CK technique" icon={<Target className="w-4 h-4" />}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="mono text-lg text-accent-400">{det.attack_technique_id}</span>
                  <span className="text-sm text-gray-300">{det.attack_technique_name}</span>
                </div>
                <Badge variant="info">Tactic: {det.tactic}</Badge>
                <Badge variant="success">Detected</Badge>
                {isBeginner && (
                  <div className="p-3 rounded-md bg-accent-500/5 border border-accent-500/20 text-xs text-gray-400">
                    <p className="font-medium text-gray-300 mb-1">What this means</p>
                    <p>This technique represents adversary behavior mapped to MITRE ATT&CK. The detection rule associated with this scenario maps the observed activity to {det.attack_technique_id}.</p>
                  </div>
                )}
              </div>
            </Collapsible>

            {/* Related simulation */}
            {det.simulation_id && (
              <Card>
                <CardHeader title="Related simulation" />
                <CardBody>
                  <button className="btn-secondary" onClick={() => navigate(`/red-team/simulations/${det.simulation_id}`)}>
                    <ArrowRight className="w-4 h-4" /> Open simulation {det.simulation_id}
                  </button>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}

// ════════════════════════════════════════
// LOGS PAGE
// ════════════════════════════════════════
export function LogsPage() {
  const [filters, setFilters] = useState<{ host?: string; platform?: string; source?: string; event_type?: string }>({});
  const api = useStableApi(() => logsApi.list(filters));
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Logs" subtitle="Searchable telemetry explorer from stored raw events." />
      <Card className="mb-4">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input className="input-field" placeholder="Filter by host" value={filters.host ?? ''} onChange={(e) => setFilters({ ...filters, host: e.target.value || undefined })} />
            <select className="input-field" value={filters.platform ?? ''} onChange={(e) => setFilters({ ...filters, platform: e.target.value || undefined })}>
              <option value="">All platforms</option><option value="windows">Windows</option><option value="linux">Linux</option>
            </select>
            <input className="input-field" placeholder="Filter by source" value={filters.source ?? ''} onChange={(e) => setFilters({ ...filters, source: e.target.value || undefined })} />
            <input className="input-field" placeholder="Filter by event type" value={filters.event_type ?? ''} onChange={(e) => setFilters({ ...filters, event_type: e.target.value || undefined })} />
          </div>
        </CardBody>
      </Card>
      <Card>
        <DataState loading={api.loading} error={api.error} empty={!api.data?.items?.length} onRetry={api.reload}>
          <Table
            data={api.data?.items ?? []}
            onRowClick={(r) => navigate(`/blue-team/logs/${r.id}`)}
            columns={[
              { key: 'timestamp', header: 'Timestamp', render: (r) => shortDate(r.timestamp) },
              { key: 'host', header: 'Host' },
              { key: 'source', header: 'Source', hideOnMobile: true },
              { key: 'event_type', header: 'Event type' },
              { key: 'event_id', header: 'Event ID', hideOnMobile: true, render: (r) => <span className="mono">{r.event_id}</span> },
              { key: 'process', header: 'Process', render: (r) => <span className="mono text-gray-400">{r.process ?? '—'}</span>, hideOnMobile: true },
              { key: 'detection_id', header: 'Detection', render: (r) => r.detection_id ? <Badge variant="success">Detected</Badge> : <span className="text-gray-600 text-xs">—</span> },
            ]}
            emptyState={<EmptyState title="No telemetry received" message="No stored raw events are currently available." icon={<FileText className="w-8 h-8" />} />}
          />
        </DataState>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════
// LOG DETAIL
// ════════════════════════════════════════
export function LogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const logApi = useStableApi(() => logsApi.get(id!));
  const normApi = useStableApi(() => logsApi.normalized(id!));
  const navigate = useNavigate();
  const log = logApi.data;
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link to="/blue-team/logs" className="text-gray-500 hover:text-gray-300">Logs</Link>
        <ChevronRight className="w-4 h-4 text-gray-700" />
        <span className="text-gray-300">{log?.event_type ?? 'Loading...'}</span>
      </div>
      <PageHeader title="Log detail" subtitle={log ? `${log.source} · Event ID ${log.event_id}` : undefined} />
      <DataState loading={logApi.loading} error={logApi.error} empty={!log} onRetry={logApi.reload}>
        {log && (
          <div className="space-y-5">
            <Card>
              <CardHeader title="Raw event" subtitle={`Source: ${log.source}`} />
              <CardBody>
                <div className="flex justify-end gap-2 mb-2">
                  <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(log.raw_data ?? '')}><Clipboard className="w-3.5 h-3.5" /> Copy</button>
                </div>
                <pre className="p-3 rounded bg-base-950 border border-base-700 mono text-xs text-gray-400 overflow-x-auto max-h-96">{log.raw_data ?? 'No raw data available'}</pre>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Normalized event" />
              <CardBody>
                {normApi.data ? (
                  <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <KV label="Timestamp" value={fullDate((normApi.data as NormalizedEvent).timestamp)} />
                    <KV label="Host" value={(normApi.data as NormalizedEvent).host} />
                    <KV label="Platform" value={(normApi.data as NormalizedEvent).platform} />
                    <KV label="Source" value={(normApi.data as NormalizedEvent).source} />
                    <KV label="Event type" value={(normApi.data as NormalizedEvent).event_type} />
                    <KV label="Event ID" value={(normApi.data as NormalizedEvent).event_id} mono />
                    {(normApi.data as NormalizedEvent).fields && Object.entries((normApi.data as NormalizedEvent).fields).map(([k, v]) => <KV key={k} label={k} value={String(v ?? '—')} mono />)}
                  </dl>
                ) : !normApi.loading && !normApi.error ? <p className="text-sm text-gray-600">No normalized event available for this log.</p> : <LoadingState />}
              </CardBody>
            </Card>
            {log.detection_id && (
              <Card>
                <CardHeader title="Associated detection" />
                <CardBody>
                  <button className="btn-secondary" onClick={() => navigate(`/blue-team/detections/${log.detection_id}`)}>
                    <ArrowRight className="w-4 h-4" /> Open detection {log.detection_id}
                  </button>
                </CardBody>
              </Card>
            )}
            {log.simulation_id && (
              <Card>
                <CardHeader title="Associated simulation" />
                <CardBody>
                  <button className="btn-secondary" onClick={() => navigate(`/red-team/simulations/${log.simulation_id}`)}>
                    <ArrowRight className="w-4 h-4" /> Open simulation {log.simulation_id}
                  </button>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}

// ════════════════════════════════════════
// ATT&CK MATRIX
// ════════════════════════════════════════
export function AttackMatrixPage() {
  const api = useStableApi(attackApi.tactics);
  const [search, setSearch] = useState('');
  const [selectedTech, setSelectedTech] = useState<AttackTechnique | null>(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!api.data) return [];
    if (!search) return api.data;
    return api.data.map((t) => ({
      ...t,
      techniques: t.techniques.filter((tech) =>
        tech.id.toLowerCase().includes(search.toLowerCase()) ||
        tech.name.toLowerCase().includes(search.toLowerCase()),
      ),
    })).filter((t) => t.techniques.length > 0);
  }, [api.data, search]);

  return (
    <div>
      <PageHeader title="ATT&CK Matrix" subtitle="Techniques organized by tactic. States reflect actual tested/detected data." action={
        <input className="input-field w-64" placeholder="Search technique..." value={search} onChange={(e) => setSearch(e.target.value)} />
      } />
      <DataState loading={api.loading} error={api.error} empty={!api.data?.length} onRetry={api.reload}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {filtered.map((tactic) => (
              <div key={tactic.id} className="w-64 flex-shrink-0">
                <div className="px-3 py-2 bg-base-800 border border-base-700 rounded-t-md">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{tactic.name}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{tactic.tested_count} tested · {tactic.detected_count} detected</p>
                </div>
                <div className="space-y-2 p-2 bg-base-900 border border-t-0 border-base-700 rounded-b-md min-h-[100px]">
                  {tactic.techniques.length === 0 ? (
                    <p className="text-xs text-gray-700 text-center py-4">No tested techniques</p>
                  ) : tactic.techniques.map((tech) => (
                    <button
                      key={tech.id}
                      onClick={() => setSelectedTech(tech)}
                      className={`w-full text-left p-2 rounded border transition-colors ${
                        tech.status === 'detected' ? 'border-success-500/30 bg-success-500/5 hover:bg-success-500/10' :
                        tech.status === 'missed' ? 'border-danger-500/30 bg-danger-500/5 hover:bg-danger-500/10' :
                        'border-base-700 bg-base-850 hover:bg-base-800'
                      }`}
                    >
                      <p className="mono text-xs text-accent-400">{tech.id}</p>
                      <p className="text-xs text-gray-300 mt-1">{tech.name}</p>
                      <div className="mt-2">
                        {tech.status === 'detected' ? <Badge variant="success">Detected</Badge> :
                         tech.status === 'missed' ? <Badge variant="danger">Missed</Badge> :
                         <Badge variant="neutral">Not tested</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DataState>
      <Drawer open={!!selectedTech} onClose={() => setSelectedTech(null)} title={selectedTech?.id ?? ''}>
        {selectedTech && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-medium text-gray-100">{selectedTech.name}</h3>
              <div className="flex gap-2 mt-2">
                <Badge variant="info">{selectedTech.tactic}</Badge>
                {selectedTech.status === 'detected' ? <Badge variant="success">Detected</Badge> :
                 selectedTech.status === 'missed' ? <Badge variant="danger">Missed</Badge> :
                 <Badge variant="neutral">Not tested</Badge>}
              </div>
            </div>
            <p className="text-sm text-gray-400">{selectedTech.description}</p>
            {selectedTech.scenarios?.length > 0 && (
              <div>
                <p className="subsection-title mb-2">Scenarios</p>
                <div className="space-y-1">{selectedTech.scenarios.map((s) => <p key={s} className="text-sm text-gray-300 mono">{s}</p>)}</div>
              </div>
            )}
            {selectedTech.detections?.length > 0 && (
              <div>
                <p className="subsection-title mb-2">Detections</p>
                <div className="space-y-1">{selectedTech.detections.map((d) => <button key={d} className="block text-sm text-accent-400 hover:underline mono" onClick={() => { navigate(`/blue-team/detections/${d}`); setSelectedTech(null); }}>{d}</button>)}</div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

// ════════════════════════════════════════
// ATT&CK COVERAGE
// ════════════════════════════════════════
export function CoveragePage() {
  const api = useStableApi(attackApi.coverage);
  const cov = api.data;
  return (
    <div>
      <PageHeader title="ATT&CK Coverage" subtitle="Detection coverage generated from actual tested techniques only." />
      <DataState loading={api.loading} error={api.error} empty={!cov} onRetry={api.reload}>
        {cov && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <Card><CardBody className="p-4"><p className="text-xs text-gray-500 mb-1">Techniques tested</p><p className="text-2xl font-semibold text-gray-100">{cov.techniques_tested}</p></CardBody></Card>
              <Card><CardBody className="p-4"><p className="text-xs text-gray-500 mb-1">Techniques detected</p><p className="text-2xl font-semibold text-success-400">{cov.techniques_detected}</p></CardBody></Card>
              <Card><CardBody className="p-4"><p className="text-xs text-gray-500 mb-1">Techniques missed</p><p className="text-2xl font-semibold text-danger-400">{cov.techniques_missed}</p></CardBody></Card>
            </div>
            <Card>
              <CardHeader title="Coverage by tactic" />
              <CardBody>
                <div className="space-y-4">
                  {cov.by_tactic?.length > 0 ? cov.by_tactic.map((t) => (
                    <div key={t.tactic}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-300">{t.tactic}</span>
                        <span className="text-xs text-gray-600">{t.detected}/{t.tested} tested</span>
                      </div>
                      <div className="h-2 rounded bg-base-700 overflow-hidden flex">
                        {t.tested > 0 && <>
                          <div className="bg-success-500" style={{ width: `${(t.detected / t.total) * 100}%` }} />
                          <div className="bg-danger-500" style={{ width: `${(t.missed / t.total) * 100}%` }} />
                        </>}
                      </div>
                      {t.tested === 0 && <p className="text-xs text-gray-700 mt-1">No implemented/tested techniques in this tactic.</p>}
                    </div>
                  )) : <EmptyState title="No coverage data" message="No techniques have been tested yet." />}
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </DataState>
    </div>
  );
}

// ════════════════════════════════════════
// AGENTS
// ════════════════════════════════════════
export function AgentsPage() {
  const api = useStableApi(agentsApi.list);
  const [selected, setSelected] = useState<Agent | null>(null);
  return (
    <div>
      <PageHeader title="Agents" subtitle="Connected lab agents and their real heartbeat status." />
      <DataState loading={api.loading} error={api.error} empty={!api.data?.length} onRetry={api.reload}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {api.data?.map((a) => (
            <Card key={a.id} hover onClick={() => setSelected(a)}>
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{a.hostname}</p>
                    <p className="text-xs text-gray-500 mt-1">{a.os}</p>
                  </div>
                  <StatusBadge status={statusVariant(a.status)}>{a.status}</StatusBadge>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  <p>{a.ip || 'IP unavailable'}</p>
                  <p>Last heartbeat: {shortDate(a.last_heartbeat)}</p>
                  <p>Agent version: {a.version || '—'}</p>
                  <p>Supported scenarios: {a.supported_scenarios?.length ?? 0}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </DataState>
      <EmptyStateHandler data={api.data} loading={api.loading} error={api.error} />
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.hostname ?? ''}>
        {selected && (
          <dl className="grid grid-cols-2 gap-4">
            <KV label="Hostname" value={selected.hostname} />
            <KV label="OS" value={selected.os} />
            <KV label="Platform" value={selected.platform} />
            <KV label="IP" value={selected.ip} />
            <KV label="Version" value={selected.version} />
            <KV label="Status" value={<StatusBadge status={statusVariant(selected.status)}>{selected.status}</StatusBadge>} />
            <KV label="Last heartbeat" value={fullDate(selected.last_heartbeat)} />
            <KV label="Registered" value={fullDate(selected.registered_at)} />
            <div className="col-span-2">
              <dt className="text-xs text-gray-600 mb-2">Supported scenarios</dt>
              <dd className="space-y-1">{selected.supported_scenarios?.length > 0 ? selected.supported_scenarios.map((s) => <p key={s} className="text-sm text-gray-300 mono">{s}</p>) : <p className="text-sm text-gray-600">None listed</p>}</dd>
            </div>
          </dl>
        )}
      </Drawer>
    </div>
  );
}
function EmptyStateHandler({ data, loading, error }: { data: Agent[] | null; loading: boolean; error: ApiClientError | null }) {
  if (loading || error || data?.length) return null;
  return null;
}

// ════════════════════════════════════════
// INFRASTRUCTURE
// ════════════════════════════════════════
export function InfrastructurePage() {
  const { status } = useSystem();
  return (
    <div>
      <PageHeader title="Infrastructure" subtitle="Backend, collector, and lab environment status." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Backend" icon={<Server className="w-4 h-4" />} />
          <CardBody>
            <dl className="space-y-3">
              <KV label="Status" value={status?.backend_connected ? <Badge variant="success">Connected</Badge> : <Badge variant="danger">Offline</Badge>} />
              <KV label="API base URL" value={API_BASE_URL} mono />
              <KV label="Environment" value={status?.environment ?? '—'} />
              <KV label="Database" value={status?.database ?? '—'} />
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Collector" icon={<Network className="w-4 h-4" />} />
          <CardBody>
            <dl className="space-y-3">
              <KV label="Status" value={status?.collector_status === 'online' ? <Badge variant="success">Online</Badge> : status?.collector_status === 'offline' ? <Badge variant="danger">Offline</Badge> : <Badge variant="neutral">Unknown</Badge>} />
              <KV label="Detection rules loaded" value={status?.detection_rules_loaded ?? 0} />
              <KV label="ATT&CK metadata loaded" value={status?.attack_metadata_loaded ?? 0} />
              <KV label="Connected agents" value={status?.agent_count ?? 0} />
            </dl>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader title="Architecture" subtitle="How data flows through AttackNavigator" />
        <CardBody>
          <HorizontalPipeline steps={[
            { label: 'Scenario', status: 'completed' },
            { label: 'VM Activity', status: 'completed' },
            { label: 'Telemetry', status: 'completed' },
            { label: 'Parser', status: 'completed' },
            { label: 'Normalizer', status: 'completed' },
            { label: 'Detection', status: 'completed' },
            { label: 'ATT&CK', status: 'completed' },
          ]} />
        </CardBody>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════
// BLUE TEAM (Live Lab + Upload)
// ════════════════════════════════════════
export function BlueTeamPage() {
  const [tab, setTab] = useState<'live' | 'upload'>('live');
  return (
    <div>
      <PageHeader title="Blue Team" subtitle="Live lab monitoring and offline log analysis." />
      <div className="flex gap-1 mb-4 border-b border-base-700">
        <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'live' ? 'text-accent-400 border-accent-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`} onClick={() => setTab('live')}>Live Lab</button>
        <button className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'upload' ? 'text-accent-400 border-accent-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`} onClick={() => setTab('upload')}>Upload Logs</button>
      </div>
      {tab === 'live' ? <LiveLabTab /> : <UploadTab />}
    </div>
  );
}

function LiveLabTab() {
  const agents = useStableApi(agentsApi.list);
  const detections = useStableApi(() => dashboardApi.recentDetections(5));
  const { status } = useSystem();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardBody className="p-4"><p className="text-xs text-gray-500 mb-1">Connected agents</p><p className="text-2xl font-semibold text-gray-100">{status?.agent_count ?? 0}</p></CardBody></Card>
        <Card><CardBody className="p-4"><p className="text-xs text-gray-500 mb-1">Collector</p><p className="text-sm font-medium mt-1">{status?.collector_status === 'online' ? <Badge variant="success">Online</Badge> : <Badge variant="danger">Offline</Badge>}</p></CardBody></Card>
        <Card><CardBody className="p-4"><p className="text-xs text-gray-500 mb-1">Recent detections</p><p className="text-2xl font-semibold text-gray-100">{detections.data?.length ?? 0}</p></CardBody></Card>
        <Card><CardBody className="p-4"><p className="text-xs text-gray-500 mb-1">Detection rules</p><p className="text-2xl font-semibold text-gray-100">{status?.detection_rules_loaded ?? 0}</p></CardBody></Card>
      </div>
      <Card>
        <CardHeader title="Connected agents" />
        <DataState loading={agents.loading} error={agents.error} empty={!agents.data?.length} onRetry={agents.reload}>
          <div className="divide-y divide-base-800">
            {agents.data?.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                <div><p className="text-sm text-gray-200">{a.hostname}</p><p className="text-xs text-gray-600">{a.os} · {a.ip || 'IP unavailable'}</p></div>
                <StatusBadge status={statusVariant(a.status)}>{a.status}</StatusBadge>
              </div>
            ))}
          </div>
        </DataState>
      </Card>
      <Card>
        <CardHeader title="Recent detections" />
        <DataState loading={detections.loading} error={detections.error} empty={!detections.data?.length} onRetry={detections.reload}>
          <div className="divide-y divide-base-800">
            {detections.data?.map((d) => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                <div><p className="text-sm text-gray-200">{d.rule_name}</p><p className="text-xs text-gray-600">{d.host} · {shortDate(d.timestamp)}</p></div>
                <SeverityBadge severity={d.severity} />
              </div>
            ))}
          </div>
        </DataState>
      </Card>
    </div>
  );
}

function UploadTab() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  const handleAnalyze = async () => {
    if (!files.length) return;
    setUploading(true); setError(''); setResult(null);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      setResult(await uploadApi.analyze(formData));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : 'Upload failed');
    } finally { setUploading(false); }
  };
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Analyze real telemetry" subtitle="Supported formats: Sysmon XML, Linux auditd logs" icon={<CloudUpload className="w-4 h-4" />} />
        <CardBody>
          <div className="border-2 border-dashed border-base-600 rounded-lg p-8 text-center">
            <CloudUpload className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">Select telemetry files to analyze using the same detection engine as live mode.</p>
            <label className="btn-primary cursor-pointer">
              <Upload className="w-4 h-4" /> Select files
              <input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} accept=".xml,.log,.txt,.json" />
            </label>
          </div>
          {files.length > 0 && (
            <div className="mt-4">
              <p className="subsection-title mb-2">Selected files</p>
              <div className="space-y-1">
                {files.map((f, i) => <p key={i} className="text-sm text-gray-300 mono">{f.name} <span className="text-gray-600">({(f.size / 1024).toFixed(1)} KB)</span></p>)}
              </div>
              <button className="btn-primary mt-4" disabled={uploading} onClick={handleAnalyze}>{uploading ? 'Analyzing...' : 'Analyze'}</button>
            </div>
          )}
          {error && <p className="text-sm text-danger-400 mt-4">{error}</p>}
        </CardBody>
      </Card>
      {result && (
        <Card>
          <CardHeader title="Upload result" />
          <CardBody>
            <Pipeline steps={[
              { label: 'Upload', status: 'completed' },
              { label: 'Parsing', status: stageStatus(result.status), description: `${result.events_parsed} events parsed` },
              { label: 'Normalization', status: result.events_normalized > 0 ? 'completed' : 'pending', description: `${result.events_normalized} events normalized` },
              { label: 'Detection', status: result.detections_generated > 0 ? 'completed' : 'pending', description: `${result.detections_generated} detections` },
              { label: 'ATT&CK mapping', status: result.attack_techniques_mapped > 0 ? 'completed' : 'pending', description: `${result.attack_techniques_mapped} techniques mapped` },
            ]} />
            {result.errors?.length > 0 && (
              <div className="mt-4 p-3 rounded bg-danger-500/5 border border-danger-500/20">
                <p className="text-xs text-danger-400 mb-1">Errors:</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-gray-500 mono">{e}</p>)}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════
// INVESTIGATIONS (detection gap view)
// ════════════════════════════════════════
export function InvestigationsPage() {
  const api = useStableApi(dashboardApi.detectionGaps);
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Investigations" subtitle="Detection gaps and validation findings from purple-team runs." />
      <Card>
        <CardHeader title="Detection gaps" subtitle="Telemetry received but expected detection was not generated" />
        <DataState loading={api.loading} error={api.error} empty={!api.data?.length} onRetry={api.reload}>
          <Table
            data={api.data ?? []}
            onRowClick={(g) => navigate(`/red-team/simulations/${g.simulation_id}`)}
            columns={[
              { key: 'scenario_name', header: 'Scenario' },
              { key: 'expected_technique_id', header: 'Expected technique', render: (g) => <span className="mono text-accent-400">{g.expected_technique_id}</span> },
              { key: 'telemetry_status', header: 'Telemetry', render: (g) => <StatusBadge status={statusVariant(g.telemetry_status)}>{g.telemetry_status}</StatusBadge> },
              { key: 'detection_status', header: 'Detection', render: (g) => <StatusBadge status={statusVariant(g.detection_status)}>{g.detection_status}</StatusBadge> },
              { key: 'timestamp', header: 'Time', render: (g) => shortDate(g.timestamp) },
            ]}
            emptyState={<EmptyState title="No detection gaps recorded" message="No detection gaps have been identified from simulation results." icon={<ShieldAlert className="w-8 h-8" />} />}
          />
        </DataState>
      </Card>
      {api.data?.length === 0 && (
        <p className="text-xs text-gray-600 mt-3 text-center">An empty result means no gaps have been found — not that detection is perfect.</p>
      )}
    </div>
  );
}

// ════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════
export function SettingsPage() {
  const { status } = useSystem();
  const { mode, setMode } = useViewMode();
  return (
    <div>
      <PageHeader title="Settings" subtitle="System configuration and status. No secrets are exposed." />
      <div className="space-y-5">
        <Card>
          <CardHeader title="Backend" icon={<Server className="w-4 h-4" />} />
          <CardBody>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KV label="Status" value={status?.backend_connected ? <Badge variant="success">Connected</Badge> : <Badge variant="danger">Offline</Badge>} />
              <KV label="API base URL" value={API_BASE_URL} mono />
              <KV label="Environment" value={status?.environment ?? '—'} />
              <KV label="Database" value={status?.database ?? '—'} />
              <KV label="Detection rules loaded" value={status?.detection_rules_loaded ?? 0} />
              <KV label="ATT&CK metadata loaded" value={status?.attack_metadata_loaded ?? 0} />
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="View mode" subtitle="Toggle between guided and standard analyst views" />
          <CardBody>
            <div className="flex gap-2">
              <button className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${mode === 'beginner' ? 'bg-accent-500/10 text-accent-300 border-accent-500/30' : 'bg-base-800 text-gray-400 border-base-700 hover:text-gray-300'}`} onClick={() => setMode('beginner')}>Guided</button>
              <button className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${mode === 'analyst' ? 'bg-accent-500/10 text-accent-300 border-accent-500/30' : 'bg-base-800 text-gray-400 border-base-700 hover:text-gray-300'}`} onClick={() => setMode('analyst')}>Standard</button>
            </div>
            <p className="text-xs text-gray-600 mt-3">Guided mode adds beginner-friendly explanations to investigation pages. Standard mode shows full technical detail.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="About" />
          <CardBody>
            <p className="text-sm text-gray-400">AttackNavigator is a controlled purple-team laboratory for security detection validation. It is not a production SIEM. All data shown originates from the FastAPI backend.</p>
            <p className="text-xs text-gray-600 mt-3">No authentication tokens, agent tokens, or backend secrets are displayed in this interface.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
