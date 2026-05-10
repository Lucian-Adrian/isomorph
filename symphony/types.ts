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
