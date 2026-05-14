export interface IssueRef {
  id: string | null;
  identifier: string | null;
  state: string | null;
}

export interface Issue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number | null;
  state: string;
  branch_name: string | null;
  url: string | null;
  labels: string[];
  blocked_by: IssueRef[];
  created_at: string | null;
  updated_at: string | null;
  verification_commands?: string[];
}

export interface WorkflowConfig {
  tracker: {
    kind: 'repo-tasks' | 'linear';
    tasks_path: string;
    active_states: string[];
    terminal_states: string[];
  };
  polling: {
    interval_ms: number;
  };
  workspace: {
    root: string;
  };
  agent: {
    command: string;
    dry_run: boolean;
    timeout_ms: number;
  };
  orchestration: {
    max_concurrent_agents: number;
    max_retries: number;
    retry_base_delay_ms: number;
    logs_path: string;
  };
  verification: {
    command: string;
    required: boolean;
  };
  handoff: {
    summary_path: string;
  };
  server: {
    port: number | null;
  };
}

export interface WorkflowDefinition {
  config: WorkflowConfig;
  promptTemplate: string;
}

export interface DispatchPlan {
  dispatch: Issue[];
  blocked: Issue[];
  ignored: Issue[];
}

export interface RunningSessionRow {
  issue_id: string;
  issue_identifier: string;
  state: string;
  session_id: string;
  turn_count: number;
  last_event: string;
  last_message: string;
  started_at: string;
  last_event_at: string;
  workspace_path: string;
  dry_run: boolean;
  attempt: number;
  tokens: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export interface RetryQueueRow {
  issue_id: string;
  issue_identifier: string;
  attempt: number;
  due_at: string;
  error: string | null;
}

export interface RuntimeIssueSummary {
  issue_id: string;
  issue_identifier: string;
  title: string;
  state: string;
  priority: number | null;
  labels: string[];
  branch_name: string | null;
  blocked_by: IssueRef[];
  eligibility: 'dispatchable' | 'blocked' | 'ignored' | 'running';
}

export interface RuntimeSnapshot {
  generated_at: string;
  counts: {
    tasks: number;
    dispatchable: number;
    blocked: number;
    ignored: number;
    running: number;
    retrying: number;
    recent_events: number;
  };
  running: RunningSessionRow[];
  retrying: RetryQueueRow[];
  codex_totals: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    seconds_running: number;
  };
  rate_limits: Record<string, unknown> | null;
  dispatchable: RuntimeIssueSummary[];
  blocked: RuntimeIssueSummary[];
  ignored: RuntimeIssueSummary[];
  running_tasks: RuntimeIssueSummary[];
  recent_events: Array<Record<string, unknown>>;
  health: {
    status: 'healthy' | 'degraded' | 'error';
    tracker_kind: WorkflowConfig['tracker']['kind'];
    dry_run: boolean;
    last_poll_at: string | null;
    last_poll_ok: boolean;
    last_error: string | null;
    server_port: number | null;
    poll_interval_ms: number;
    logs_path: string;
    checks: Array<{
      name: string;
      status: 'healthy' | 'degraded' | 'error' | 'info';
      detail: string;
    }>;
  };
  workflow: {
    active_states: string[];
    terminal_states: string[];
    workspace_root: string;
    verification_required: boolean;
    workflow_path: string;
  };
  runtime: {
    no_token_spend: boolean;
    local_setup_commands: string[];
  };
}

export interface RuntimeIssueDetail {
  issue_identifier: string;
  issue_id: string;
  status: 'running' | 'retrying' | 'idle';
  workspace: {
    path: string | null;
  };
  attempts: {
    restart_count: number;
    current_retry_attempt: number;
  };
  running: RunningSessionRow | null;
  retry: RetryQueueRow | null;
  logs: {
    codex_session_logs: Array<{
      label: string;
      path: string;
    }>;
  };
  recent_events: Array<Record<string, unknown>>;
  last_error: string | null;
  tracked: Record<string, unknown>;
}
