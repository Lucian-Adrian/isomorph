import type {
  Issue,
  RetryQueueRow,
  RunningSessionRow,
  RuntimeIssueDetail,
  RuntimeIssueSummary,
  RuntimeSnapshot,
  WorkflowConfig,
} from './types.js';

interface UsageSnapshot {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

interface RunStartInput {
  issue_id: string;
  issue_identifier: string;
  issue_state: string;
  session_id: string;
  started_at: string;
  workspace_path: string;
  dry_run: boolean;
  attempt?: number;
}

interface RunEventInput {
  event: string;
  at: string;
  message?: string;
  usage?: UsageSnapshot;
}

interface RetryInput {
  issue_id: string;
  issue_identifier: string;
  attempt: number;
  due_at: string;
  error: string | null;
}

interface ConfigureInput {
  trackerKind: WorkflowConfig['tracker']['kind'];
  dryRun: boolean;
  serverPort: number | null;
  pollIntervalMs: number;
  logsPath: string;
  activeStates: string[];
  terminalStates: string[];
  workspaceRoot: string;
  verificationRequired: boolean;
  workflowPath?: string;
}

interface TrackerPlanInput {
  tasks: Issue[];
  dispatchable: Issue[];
  blocked: Issue[];
  ignored: Issue[];
}

interface RecentEventRow extends Record<string, unknown> {
  at: string;
  event: string;
  issue_identifier: string;
  message: string;
}

interface IssueCounters {
  restart_count: number;
  current_retry_attempt: number;
  workspace_path: string | null;
}

function safeNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function cloneRunningRow(row: RunningSessionRow): RunningSessionRow {
  return {
    ...row,
    tokens: { ...row.tokens },
  };
}

function summarizeIssue(issue: Issue, eligibility: RuntimeIssueSummary['eligibility']): RuntimeIssueSummary {
  return {
    issue_id: issue.id,
    issue_identifier: issue.identifier,
    title: issue.title,
    state: issue.state,
    priority: issue.priority,
    labels: issue.labels,
    branch_name: issue.branch_name,
    blocked_by: issue.blocked_by,
    eligibility,
  };
}

function runtimeSeconds(startedAt: string, at: string) {
  const startMs = Date.parse(startedAt);
  const atMs = Date.parse(at);
  if (Number.isNaN(startMs) || Number.isNaN(atMs) || atMs < startMs) return 0;
  return (atMs - startMs) / 1000;
}

export function createRuntimeStore() {
  const runningByIdentifier = new Map<string, RunningSessionRow>();
  const retryByIdentifier = new Map<string, RetryQueueRow>();
  const recentEvents: RecentEventRow[] = [];
  const issueCounters = new Map<string, IssueCounters>();
  const trackerPlan: TrackerPlanInput = {
    tasks: [],
    dispatchable: [],
    blocked: [],
    ignored: [],
  };

  let rateLimits: Record<string, unknown> | null = null;
  let totals = {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
  };
  let completedSeconds = 0;

  const health: RuntimeSnapshot['health'] = {
    status: 'healthy',
    tracker_kind: 'repo-tasks',
    dry_run: true,
    last_poll_at: null,
    last_poll_ok: true,
    last_error: null,
    server_port: null,
    poll_interval_ms: 0,
    logs_path: '',
    checks: [],
  };

  const workflow: RuntimeSnapshot['workflow'] = {
    active_states: [],
    terminal_states: [],
    workspace_root: '',
    verification_required: false,
    workflow_path: 'WORKFLOW.md',
  };

  function issueKey(identifier: string) {
    return identifier.toLowerCase();
  }

  function ensureCounters(identifier: string) {
    const key = issueKey(identifier);
    let counters = issueCounters.get(key);
    if (!counters) {
      counters = { restart_count: 0, current_retry_attempt: 0, workspace_path: null };
      issueCounters.set(key, counters);
    }
    return counters;
  }

  function pushEvent(entry: RecentEventRow) {
    recentEvents.push(entry);
    if (recentEvents.length > 120) recentEvents.splice(0, recentEvents.length - 120);
  }

  function setHealthStatus() {
    health.status = health.last_poll_ok ? 'healthy' : 'degraded';
    health.checks = [
      {
        name: 'tracker_poll',
        status: health.last_poll_ok ? 'healthy' : 'degraded',
        detail: health.last_error ?? 'Latest poll completed successfully.',
      },
      {
        name: 'http_server',
        status: health.server_port === null ? 'info' : 'healthy',
        detail: health.server_port === null ? 'HTTP server disabled.' : `Listening on loopback port ${health.server_port}.`,
      },
      {
        name: 'dry_run',
        status: health.dry_run ? 'info' : 'healthy',
        detail: health.dry_run ? 'Dry-run mode avoids external token spend.' : 'Agent execution enabled.',
      },
    ];
  }

  return {
    configure(input: ConfigureInput) {
      health.tracker_kind = input.trackerKind;
      health.dry_run = input.dryRun;
      health.server_port = input.serverPort;
      health.poll_interval_ms = input.pollIntervalMs;
      health.logs_path = input.logsPath;
      workflow.active_states = [...input.activeStates];
      workflow.terminal_states = [...input.terminalStates];
      workflow.workspace_root = input.workspaceRoot;
      workflow.verification_required = input.verificationRequired;
      workflow.workflow_path = input.workflowPath ?? workflow.workflow_path;
      setHealthStatus();
    },

    setTrackerPlan(input: TrackerPlanInput) {
      trackerPlan.tasks = [...input.tasks];
      trackerPlan.dispatchable = [...input.dispatchable];
      trackerPlan.blocked = [...input.blocked];
      trackerPlan.ignored = [...input.ignored];
    },

    notePoll(input: { at?: string; ok: boolean; error?: string | null }) {
      health.last_poll_at = input.at ?? new Date().toISOString();
      health.last_poll_ok = input.ok;
      health.last_error = input.error ?? null;
      setHealthStatus();
    },

    startRun(input: RunStartInput) {
      const key = issueKey(input.issue_identifier);
      const row: RunningSessionRow = {
        issue_id: input.issue_id,
        issue_identifier: input.issue_identifier,
        state: input.issue_state,
        session_id: input.session_id,
        turn_count: 0,
        last_event: 'session_started',
        last_message: input.dry_run ? 'Dry run session prepared.' : 'Worker session started.',
        started_at: input.started_at,
        last_event_at: input.started_at,
        workspace_path: input.workspace_path,
        dry_run: input.dry_run,
        attempt: input.attempt ?? 0,
        tokens: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
        },
      };
      runningByIdentifier.set(key, row);
      retryByIdentifier.delete(key);
      const counters = ensureCounters(input.issue_identifier);
      counters.restart_count += 1;
      counters.current_retry_attempt = input.attempt ?? 0;
      counters.workspace_path = input.workspace_path;
      pushEvent({
        at: input.started_at,
        event: 'session_started',
        issue_identifier: input.issue_identifier,
        message: row.last_message,
      });
    },

    noteRunEvent(issueIdentifier: string, input: RunEventInput) {
      const key = issueKey(issueIdentifier);
      const row = runningByIdentifier.get(key);
      if (!row) {
        pushEvent({
          at: input.at,
          event: input.event,
          issue_identifier: issueIdentifier,
          message: input.message ?? '',
        });
        return;
      }

      row.turn_count += 1;
      row.last_event = input.event;
      row.last_event_at = input.at;
      row.last_message = input.message ?? row.last_message;
      if (input.usage) {
        row.tokens.input_tokens += safeNumber(input.usage.input_tokens);
        row.tokens.output_tokens += safeNumber(input.usage.output_tokens);
        row.tokens.total_tokens += safeNumber(input.usage.total_tokens)
          || safeNumber(input.usage.input_tokens) + safeNumber(input.usage.output_tokens);
        totals = {
          input_tokens: totals.input_tokens + safeNumber(input.usage.input_tokens),
          output_tokens: totals.output_tokens + safeNumber(input.usage.output_tokens),
          total_tokens: totals.total_tokens + (safeNumber(input.usage.total_tokens)
            || safeNumber(input.usage.input_tokens) + safeNumber(input.usage.output_tokens)),
        };
      }

      pushEvent({
        at: input.at,
        event: input.event,
        issue_identifier: issueIdentifier,
        message: input.message ?? '',
      });
    },

    finishRun(issueIdentifier: string, input?: { at?: string; event?: string; message?: string }) {
      const key = issueKey(issueIdentifier);
      const row = runningByIdentifier.get(key);
      if (!row) return;
      const at = input?.at ?? new Date().toISOString();
      completedSeconds += runtimeSeconds(row.started_at, at);
      pushEvent({
        at,
        event: input?.event ?? 'session_finished',
        issue_identifier: row.issue_identifier,
        message: input?.message ?? 'Worker session finished.',
      });
      runningByIdentifier.delete(key);
    },

    scheduleRetry(input: RetryInput) {
      const key = issueKey(input.issue_identifier);
      retryByIdentifier.set(key, {
        issue_id: input.issue_id,
        issue_identifier: input.issue_identifier,
        attempt: input.attempt,
        due_at: input.due_at,
        error: input.error,
      });
      const counters = ensureCounters(input.issue_identifier);
      counters.current_retry_attempt = input.attempt;
      pushEvent({
        at: input.due_at,
        event: 'retry_scheduled',
        issue_identifier: input.issue_identifier,
        message: input.error ?? 'Retry scheduled.',
      });
    },

    clearRetry(issueIdentifier: string) {
      retryByIdentifier.delete(issueKey(issueIdentifier));
    },

    noteRateLimits(snapshot: Record<string, unknown> | null) {
      rateLimits = snapshot ? { ...snapshot } : null;
    },

    recent(limit = 40) {
      return recentEvents.slice(-Math.max(1, limit)).map(entry => ({ ...entry }));
    },

    runningRows() {
      return Array.from(runningByIdentifier.values()).map(cloneRunningRow);
    },

    retryRows() {
      return Array.from(retryByIdentifier.values()).map(entry => ({ ...entry }));
    },

    issueDetail(issueIdentifier: string): RuntimeIssueDetail | null {
      const key = issueKey(issueIdentifier);
      const running = runningByIdentifier.get(key) ? cloneRunningRow(runningByIdentifier.get(key)!) : null;
      const retry = retryByIdentifier.get(key) ? { ...retryByIdentifier.get(key)! } : null;
      const filteredEvents = recentEvents.filter(entry => String(entry.issue_identifier).toLowerCase() === key);
      const counters = issueCounters.get(key) ?? { restart_count: 0, current_retry_attempt: 0, workspace_path: null };
      if (!running && !retry && filteredEvents.length === 0) return null;
      return {
        issue_identifier: issueIdentifier,
        issue_id: running?.issue_id ?? retry?.issue_id ?? issueIdentifier,
        status: running ? 'running' : retry ? 'retrying' : 'idle',
        workspace: {
          path: running?.workspace_path ?? counters.workspace_path,
        },
        attempts: {
          restart_count: counters.restart_count,
          current_retry_attempt: counters.current_retry_attempt,
        },
        running,
        retry,
        logs: {
          codex_session_logs: [],
        },
        recent_events: filteredEvents.map(entry => ({ ...entry })),
        last_error: retry?.error ?? null,
        tracked: {},
      };
    },

    snapshot(at = new Date().toISOString()): RuntimeSnapshot {
      const running = this.runningRows();
      const retrying = this.retryRows();
      const runningTasks = trackerPlan.tasks
        .filter(issue => running.some(run => run.issue_identifier === issue.identifier))
        .map(issue => summarizeIssue(issue, 'running'));
      const secondsRunning = completedSeconds + running.reduce((sum, row) => sum + runtimeSeconds(row.started_at, at), 0);

      return {
        generated_at: at,
        counts: {
          tasks: trackerPlan.tasks.length,
          dispatchable: trackerPlan.dispatchable.length,
          blocked: trackerPlan.blocked.length,
          ignored: trackerPlan.ignored.length,
          running: running.length,
          retrying: retrying.length,
          recent_events: recentEvents.length,
        },
        running,
        retrying,
        dispatchable: trackerPlan.dispatchable.map(issue => summarizeIssue(issue, 'dispatchable')),
        blocked: trackerPlan.blocked.map(issue => summarizeIssue(issue, 'blocked')),
        ignored: trackerPlan.ignored.map(issue => summarizeIssue(issue, 'ignored')),
        running_tasks: runningTasks,
        recent_events: this.recent(),
        codex_totals: {
          ...totals,
          seconds_running: Number(secondsRunning.toFixed(1)),
        },
        rate_limits: rateLimits ? { ...rateLimits } : null,
        health: { ...health, checks: health.checks.map(check => ({ ...check })) },
        workflow: { ...workflow },
        runtime: {
          no_token_spend: health.dry_run,
          local_setup_commands: [
            'npm run symphony:dashboard',
            'npm run symphony:check',
            'npm run symphony:once',
          ],
        },
      };
    },
  };
}

export type RuntimeStore = ReturnType<typeof createRuntimeStore>;
