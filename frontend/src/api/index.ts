import { apiGet, apiPost, apiUpload } from './client';
import type {
  Agent,
  Scenario,
  SimulationRun,
  Detection,
  RawLog,
  NormalizedEvent,
  DetectionRule,
  AttackTechnique,
  AttackTactic,
  DashboardStats,
  DetectionGap,
  SystemStatus,
  CoverageSummary,
  UploadResult,
  PaginatedResponse,
} from '@/types';

// ===== Agents =====
export const agentsApi = {
  list: () => apiGet<Agent[]>('/agents'),
  get: (id: string) => apiGet<Agent>(`/agents/${id}`),
};

// ===== Scenarios =====
export const scenariosApi = {
  list: () => apiGet<Scenario[]>('/scenarios'),
  get: (id: string) => apiGet<Scenario>(`/scenarios/${id}`),
};

// ===== Simulations =====
export const simulationsApi = {
  list: (params?: { page?: number; page_size?: number }) => {
    const query = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()}`
      : '';
    return apiGet<PaginatedResponse<SimulationRun>>(`/simulations${query}`);
  },
  get: (id: string) => apiGet<SimulationRun>(`/simulations/${id}`),
  run: (body: { scenario_id: string; target_agent_id: string; attacker_agent_id?: string }) =>
    apiPost<SimulationRun>('/simulations/run', body),
  status: (id: string) => apiGet<SimulationRun>(`/simulations/${id}/status`),
};

// ===== Detections =====
export const detectionsApi = {
  list: (params?: {
    severity?: string;
    platform?: string;
    host?: string;
    tactic?: string;
    technique?: string;
    scenario?: string;
    page?: number;
    page_size?: number;
  }) => {
    const query = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v]) => [k, String(v)]),
        ).toString()}`
      : '';
    return apiGet<PaginatedResponse<Detection>>(`/detections${query}`);
  },
  get: (id: string) => apiGet<Detection>(`/detections/${id}`),
};

// ===== Logs =====
export const logsApi = {
  list: (params?: {
    host?: string;
    platform?: string;
    source?: string;
    event_type?: string;
    event_id?: string;
    scenario?: string;
    page?: number;
    page_size?: number;
  }) => {
    const query = params
      ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v]) => [k, String(v)]),
        ).toString()}`
      : '';
    return apiGet<PaginatedResponse<RawLog>>(`/logs${query}`);
  },
  get: (id: string) => apiGet<RawLog>(`/logs/${id}`),
  normalized: (id: string) => apiGet<NormalizedEvent>(`/logs/${id}/normalized`),
};

// ===== Detection Rules =====
export const rulesApi = {
  list: () => apiGet<DetectionRule[]>('/rules'),
  get: (id: string) => apiGet<DetectionRule>(`/rules/${id}`),
};

// ===== ATT&CK =====
export const attackApi = {
  tactics: () => apiGet<AttackTactic[]>('/attack/tactics'),
  techniques: () => apiGet<AttackTechnique[]>('/attack/techniques'),
  technique: (id: string) => apiGet<AttackTechnique>(`/attack/techniques/${id}`),
  coverage: () => apiGet<CoverageSummary>('/attack/coverage'),
};

// ===== Dashboard =====
export const dashboardApi = {
  stats: () => apiGet<DashboardStats>('/dashboard/stats'),
  recentSimulations: (limit?: number) =>
    apiGet<SimulationRun[]>(`/dashboard/recent-simulations${limit ? `?limit=${limit}` : ''}`),
  recentDetections: (limit?: number) =>
    apiGet<Detection[]>(`/dashboard/recent-detections${limit ? `?limit=${limit}` : ''}`),
  detectionGaps: () => apiGet<DetectionGap[]>('/dashboard/detection-gaps'),
};

// ===== System / Status =====
export const systemApi = {
  status: () => apiGet<SystemStatus>('/system/status'),
  health: () => apiGet<{ status: string }>('/health'),
};

// ===== Upload =====
export const uploadApi = {
  analyze: (formData: FormData) => apiUpload<UploadResult>('/upload/analyze', formData),
};

// ===== Global Search =====
export const searchApi = {
  search: (query: string) =>
    apiGet<{
      scenarios: Scenario[];
      detections: Detection[];
      techniques: AttackTechnique[];
      hosts: { host: string; count: number }[];
      logs: RawLog[];
      simulations: SimulationRun[];
    }>(`/search?q=${encodeURIComponent(query)}`),
};
