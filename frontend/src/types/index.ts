// ===== AttackNavigator Type Models =====

export type Platform = 'windows' | 'linux' | 'macos' | 'multi';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SimulationStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'timeout'
  | 'cancelled';
export type TelemetryStatus = 'pending' | 'received' | 'failed' | 'partial';
export type DetectionStatus = 'pending' | 'detected' | 'missed' | 'failed';
export type AgentStatus = 'online' | 'offline' | 'degraded';
export type PipelineStageStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';
export type ViewMode = 'beginner' | 'analyst';

export interface Agent {
  id: string;
  hostname: string;
  platform: Platform;
  os: string;
  ip: string;
  version: string;
  status: AgentStatus;
  last_heartbeat: string | null;
  supported_scenarios: string[];
  registered_at: string | null;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  tactic: string;
  technique_id: string;
  technique_name: string;
  platform: Platform;
  target: string;
  expected_telemetry: string;
  expected_event: string;
  expected_detection_rule: string;
  detection_rule_id: string | null;
  status: 'implemented' | 'planned' | 'deprecated';
  prerequisites: string[];
}

export interface SimulationRun {
  id: string;
  scenario_id: string;
  scenario_name: string;
  target_agent_id: string;
  target_hostname: string;
  attacker_agent_id: string | null;
  attacker_hostname: string | null;
  status: SimulationStatus;
  telemetry_status: TelemetryStatus;
  parsing_status: PipelineStageStatus;
  detection_status: DetectionStatus;
  attack_technique_id: string | null;
  attack_technique_name: string | null;
  severity: Severity | null;
  created_at: string;
  completed_at: string | null;
  timeline: SimulationTimelineEvent[];
  expected: ExpectedResult;
  actual: ActualResult | null;
  raw_log_ids: string[];
  normalized_event_ids: string[];
  detection_ids: string[];
}

export interface SimulationTimelineEvent {
  timestamp: string;
  stage: string;
  status: PipelineStageStatus;
  message: string;
}

export interface ExpectedResult {
  telemetry: string;
  event_type: string;
  attack_technique_id: string;
  attack_technique_name: string;
  detection_rule_id: string;
  detection_rule_name: string;
  tactic: string;
  severity: Severity;
}

export interface ActualResult {
  telemetry: string | null;
  event_type: string | null;
  attack_technique_id: string | null;
  attack_technique_name: string | null;
  detection_rule_id: string | null;
  detection_rule_name: string | null;
  detection_id: string | null;
  match: 'match' | 'mismatch' | 'partial';
}

export interface RawLog {
  id: string;
  timestamp: string;
  host: string;
  platform: Platform;
  source: string;
  event_type: string;
  event_id: number | string;
  process: string | null;
  raw_data: string;
  normalized_event_id: string | null;
  detection_id: string | null;
  simulation_id: string | null;
  scenario_id: string | null;
}

export interface NormalizedEvent {
  id: string;
  timestamp: string;
  host: string;
  platform: Platform;
  source: string;
  event_type: string;
  event_id: number | string;
  fields: Record<string, string | number | boolean | null>;
  raw_log_id: string;
  detection_id: string | null;
  simulation_id: string | null;
  scenario_id: string | null;
}

export interface Detection {
  id: string;
  rule_id: string;
  rule_name: string;
  host: string;
  platform: Platform;
  severity: Severity;
  attack_technique_id: string;
  attack_technique_name: string;
  tactic: string;
  timestamp: string;
  scenario_id: string | null;
  scenario_name: string | null;
  simulation_id: string | null;
  normalized_event_id: string | null;
  raw_log_id: string | null;
  matched_fields: MatchedField[];
}

export interface MatchedField {
  field: string;
  operator: string;
  expected: string;
  actual: string;
}

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  event_type: string;
  conditions: Record<string, unknown>;
  severity: Severity;
  attack_technique_id: string;
  attack_technique_name: string;
  tactic: string;
  enabled: boolean;
  yaml: string;
}

export interface AttackTechnique {
  id: string;
  name: string;
  tactic: string;
  description: string;
  platform: Platform[];
  subtechniques: AttackSubTechnique[];
  status: 'detected' | 'missed' | 'not_tested';
  tested: boolean;
  scenarios: string[];
  detections: string[];
  detection_count: number;
  test_count: number;
}

export interface AttackSubTechnique {
  id: string;
  name: string;
  description: string;
  status: 'detected' | 'missed' | 'not_tested';
  tested: boolean;
  detection_count: number;
  test_count: number;
}

export interface AttackTactic {
  id: string;
  name: string;
  techniques: AttackTechnique[];
  tested_count: number;
  detected_count: number;
  missed_count: number;
}

export interface DashboardStats {
  connected_agents: number;
  simulation_runs: number;
  detections: number;
  detection_gaps: number;
  techniques_tested: number;
  techniques_detected: number;
}

export interface DetectionGap {
  id: string;
  scenario_id: string;
  scenario_name: string;
  expected_technique_id: string;
  expected_technique_name: string;
  telemetry_status: TelemetryStatus;
  detection_status: DetectionStatus;
  simulation_id: string;
  timestamp: string;
  explanation: string;
}

export interface SystemStatus {
  backend_connected: boolean;
  api_base_url: string;
  environment: string;
  database: string;
  detection_rules_loaded: number;
  attack_metadata_loaded: number;
  collector_status: 'online' | 'offline' | 'unknown';
  agent_count: number;
}

export interface CoverageSummary {
  techniques_tested: number;
  techniques_detected: number;
  techniques_missed: number;
  by_tactic: TacticCoverage[];
}

export interface TacticCoverage {
  tactic: string;
  tested: number;
  detected: number;
  missed: number;
  total: number;
}

export interface UploadResult {
  id: string;
  filename: string;
  status: PipelineStageStatus;
  events_parsed: number;
  events_normalized: number;
  detections_generated: number;
  attack_techniques_mapped: number;
  errors: string[];
}

// API response wrappers
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiError {
  detail: string;
  status: number;
}
