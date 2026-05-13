import { resolve } from 'node:path';
import { createOrchestrator } from './orchestrator.js';
import { JsonlLogger } from './logger.js';
import { loadRepoTasks } from './repo-task-tracker.js';
import { loadWorkflow } from './workflow.js';
import type {
  Issue,
  RetryQueueRow,
  RunningSessionRow,
  RuntimeIssueDetail,
  RuntimeIssueSummary,
  RuntimeSnapshot,
  WorkflowDefinition,
} from './types.js';
import type { RuntimeStore } from './runtime-state.js';

interface DashboardStateInput {
  repoRoot: string;
  workflowPath?: string;
  serverPort?: number | null;
  store?: RuntimeStore;
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

function deriveRunningFromEvents(events: Array<Record<string, unknown>>): RunningSessionRow[] {
  const active = new Map<string, RunningSessionRow>();
  for (const event of events) {
    const issueIdentifier = typeof event.issue_identifier === 'string' ? event.issue_identifier : null;
    if (!issueIdentifier) continue;
    const name = issueIdentifier.toLowerCase();
    const kind = typeof event.event === 'string' ? event.event : 'other';
    const at = typeof event.at === 'string' ? event.at : new Date().toISOString();
    if (kind === 'dispatch_started' || kind === 'agent_prompt_rendered') {
      const existing = active.get(name);
      if (!existing) {
        active.set(name, {
          issue_id: typeof event.issue_id === 'string' ? event.issue_id : issueIdentifier,
          issue_identifier: issueIdentifier,
          state: typeof event.issue_state === 'string' ? event.issue_state : 'active',
          session_id: `${issueIdentifier}-local`,
          turn_count: 0,
          last_event: kind,
          last_message: typeof event.message === 'string' ? event.message : 'Recent run detected from logs.',
          started_at: at,
          last_event_at: at,
          workspace_path: typeof event.workspace_path === 'string' ? event.workspace_path : '',
          dry_run: Boolean(event.dry_run),
          attempt: typeof event.attempt === 'number' ? event.attempt : 0,
          tokens: {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
          },
        });
      } else {
        existing.last_event = kind;
        existing.last_event_at = at;
      }
    }
    if (kind === 'dispatch_finished' || kind === 'dispatch_failed' || kind === 'session_finished') {
      active.delete(name);
    }
  }
  return Array.from(active.values());
}

function mergeRunningRows(primary: RunningSessionRow[], fallback: RunningSessionRow[]) {
  const merged = new Map<string, RunningSessionRow>();
  for (const row of fallback) merged.set(row.issue_identifier.toLowerCase(), row);
  for (const row of primary) merged.set(row.issue_identifier.toLowerCase(), row);
  return Array.from(merged.values());
}

function healthStatus(checks: RuntimeSnapshot['health']['checks']): RuntimeSnapshot['health']['status'] {
  if (checks.some(check => check.status === 'error')) return 'error';
  if (checks.some(check => check.status === 'degraded')) return 'degraded';
  return 'healthy';
}

function findLastEvent(events: Array<Record<string, unknown>>, predicate: (event: Record<string, unknown>) => boolean) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (predicate(event)) return event;
  }
  return null;
}

function buildIssueDetailFromSnapshot(snapshot: RuntimeSnapshot, identifier: string): RuntimeIssueDetail | null {
  const key = identifier.toLowerCase();
  const running = snapshot.running.find(row => row.issue_identifier.toLowerCase() === key) ?? null;
  const retry = snapshot.retrying.find(row => row.issue_identifier.toLowerCase() === key) ?? null;
  const summary = [...snapshot.running_tasks, ...snapshot.dispatchable, ...snapshot.blocked, ...snapshot.ignored]
    .find(issue => issue.issue_identifier.toLowerCase() === key);
  if (!running && !retry && !summary) return null;

  return {
    issue_identifier: identifier,
    issue_id: running?.issue_id ?? retry?.issue_id ?? summary?.issue_id ?? identifier,
    status: running ? 'running' : retry ? 'retrying' : 'idle',
    workspace: {
      path: running?.workspace_path ?? null,
    },
    attempts: {
      restart_count: retry?.attempt ?? running?.attempt ?? 0,
      current_retry_attempt: retry?.attempt ?? 0,
    },
    running,
    retry,
    logs: {
      codex_session_logs: snapshot.health.logs_path
        ? [{ label: 'structured-runtime-log', path: snapshot.health.logs_path }]
        : [],
    },
    recent_events: snapshot.recent_events.filter(event => {
      return typeof event.issue_identifier === 'string' && event.issue_identifier.toLowerCase() === key;
    }),
    last_error: retry?.error ?? snapshot.health.last_error,
    tracked: summary ? { eligibility: summary.eligibility, title: summary.title } : {},
  };
}

export function loadDashboardContext(input: DashboardStateInput): {
  workflow: WorkflowDefinition;
  logger: JsonlLogger;
  tasksPath: string;
  workspaceRoot: string;
  logsPath: string;
  workflowPath: string;
} {
  const workflowPath = resolve(input.repoRoot, input.workflowPath ?? 'WORKFLOW.md');
  const workflow = loadWorkflow(workflowPath);
  const logsPath = resolve(input.repoRoot, workflow.config.orchestration.logs_path);
  return {
    workflow,
    logger: new JsonlLogger(logsPath),
    tasksPath: resolve(input.repoRoot, workflow.config.tracker.tasks_path),
    workspaceRoot: resolve(input.repoRoot, workflow.config.workspace.root),
    logsPath,
    workflowPath,
  };
}

export function buildRuntimeSnapshot(input: DashboardStateInput): RuntimeSnapshot {
  const context = loadDashboardContext(input);
  const tasks = loadRepoTasks(
    context.tasksPath,
    context.workflow.config.tracker.active_states,
    context.workflow.config.tracker.terminal_states,
  );
  const recentEvents = context.logger.recent(60);
  const storeSnapshot = input.store?.snapshot();
  const runningRows = mergeRunningRows(storeSnapshot?.running ?? [], deriveRunningFromEvents(recentEvents));
  const retryRows: RetryQueueRow[] = storeSnapshot?.retrying ?? [];

  const orchestrator = createOrchestrator({
    maxConcurrentAgents: context.workflow.config.orchestration.max_concurrent_agents,
    activeStates: context.workflow.config.tracker.active_states,
    terminalStates: context.workflow.config.tracker.terminal_states,
  });
  for (const row of runningRows) {
    orchestrator.claimed.add(row.issue_id);
  }
  const plan = orchestrator.planDispatch(tasks);
  const runningIdSet = new Set(runningRows.map(row => row.issue_id));
  const runningTasks = tasks
    .filter(issue => runningIdSet.has(issue.id))
    .map(issue => summarizeIssue(issue, 'running'));

  const counts = {
    tasks: tasks.length,
    dispatchable: plan.dispatch.length,
    blocked: plan.blocked.length,
    ignored: plan.ignored.length,
    running: runningRows.length,
    retrying: retryRows.length,
    recent_events: recentEvents.length,
  };

  const tokenTotals = storeSnapshot?.codex_totals ?? {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    seconds_running: runningRows.reduce((sum, row) => {
      return sum + Math.max(0, Math.round((Date.now() - new Date(row.started_at).getTime()) / 1000));
    }, 0),
  };

  const checks: RuntimeSnapshot['health']['checks'] = [
    {
      name: 'Workflow contract',
      status: 'healthy',
      detail: context.workflow.config.tracker.kind === 'repo-tasks'
        ? 'Repo-local tracker configured and loadable.'
        : `Tracker configured: ${context.workflow.config.tracker.kind}.`,
    },
    {
      name: 'Execution posture',
      status: context.workflow.config.agent.dry_run ? 'info' : 'healthy',
      detail: context.workflow.config.agent.dry_run
        ? 'Dry run is enabled, so the dashboard can be exercised without LLM token spend.'
        : 'Live agent execution is enabled; dashboard reflects real orchestration activity.',
    },
    {
      name: 'Task inventory',
      status: tasks.length > 0 ? 'healthy' : 'degraded',
      detail: tasks.length > 0
        ? `${tasks.length} repo task${tasks.length === 1 ? '' : 's'} discovered under orchestration/tasks.`
        : 'No task files were discovered in the configured tracker path.',
    },
    {
      name: 'Runtime log stream',
      status: recentEvents.length > 0 ? 'healthy' : 'degraded',
      detail: recentEvents.length > 0
        ? `${recentEvents.length} recent JSONL event${recentEvents.length === 1 ? '' : 's'} available for debugging.`
        : 'No structured runtime events found yet; run once/daemon to seed observability.',
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    counts,
    running: runningRows,
    retrying: retryRows,
    codex_totals: tokenTotals,
    rate_limits: storeSnapshot?.rate_limits ?? null,
    dispatchable: plan.dispatch.map(issue => summarizeIssue(issue, 'dispatchable')),
    blocked: plan.blocked.map(issue => summarizeIssue(issue, 'blocked')),
    ignored: plan.ignored.map(issue => summarizeIssue(issue, 'ignored')),
    running_tasks: runningTasks,
    recent_events: recentEvents,
    health: {
      status: healthStatus(checks),
      tracker_kind: context.workflow.config.tracker.kind,
      dry_run: context.workflow.config.agent.dry_run,
      last_poll_at: findLastEvent(recentEvents, event => event.event === 'poll_completed')?.at as string | undefined ?? null,
      last_poll_ok: !recentEvents.some(event => event.event === 'poll_failed'),
      last_error: findLastEvent(recentEvents, event => {
        return event.event === 'poll_failed' || event.event === 'dispatch_failed' || event.event === 'verification_failed';
      })?.error as string | undefined ?? null,
      server_port: input.serverPort ?? context.workflow.config.server.port,
      poll_interval_ms: context.workflow.config.polling.interval_ms,
      logs_path: context.logsPath,
      checks,
    },
    workflow: {
      active_states: context.workflow.config.tracker.active_states,
      terminal_states: context.workflow.config.tracker.terminal_states,
      workspace_root: context.workspaceRoot,
      verification_required: context.workflow.config.verification.required,
      workflow_path: context.workflowPath,
    },
    runtime: {
      no_token_spend: context.workflow.config.agent.dry_run,
      local_setup_commands: [
        'npm run symphony:dashboard',
        'npm run symphony:once',
        'npm run symphony:daemon',
      ],
    },
  };
}

export function buildIssueDetail(input: DashboardStateInput, identifier: string) {
  return buildIssueDetailFromSnapshot(buildRuntimeSnapshot(input), identifier);
}
