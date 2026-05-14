import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadWorkflow } from '../symphony/workflow.js';
import { loadRepoTasks } from '../symphony/repo-task-tracker.js';
import { createOrchestrator } from '../symphony/orchestrator.js';
import { workspacePathForIssue } from '../symphony/workspace.js';
import { JsonlLogger } from '../symphony/logger.js';
import { runAgentForIssue } from '../symphony/agent-runner.js';
import { createRuntimeStore } from '../symphony/runtime-state.js';
import { startSymphonyServer } from '../symphony/server.js';
import { parseCliArgs } from '../symphony/cli.js';
import { renderDashboardHtml } from '../symphony/dashboard.js';
import type { WorkflowDefinition } from '../symphony/types.js';

function tempRepo() {
  return mkdtempSync(join(tmpdir(), 'isomorph-symphony-'));
}

describe('Symphony workflow loader', () => {
  it('parses WORKFLOW.md front matter and prompt body with typed defaults', () => {
    const dir = tempRepo();
    writeFileSync(join(dir, 'WORKFLOW.md'), `---
tracker:
  kind: repo-tasks
  tasks_path: orchestration/tasks
polling:
  interval_ms: 250
workspace:
  root: .worktrees/symphony
agent:
  command: codex
  dry_run: true
server:
  port: 4012
---
Implement {{issue.identifier}}.
`);

    const workflow = loadWorkflow(join(dir, 'WORKFLOW.md'));

    expect(workflow.config.tracker.kind).toBe('repo-tasks');
    expect(workflow.config.polling.interval_ms).toBe(250);
    expect(workflow.config.workspace.root).toBe('.worktrees/symphony');
    expect(workflow.config.agent.dry_run).toBe(true);
    expect(workflow.config.server.port).toBe(4012);
    expect(workflow.promptTemplate).toBe('Implement {{issue.identifier}}.');
  });
});

describe('Symphony CLI args', () => {
  it('parses --port and lets it override workflow config', () => {
    const args = parseCliArgs(['daemon', '--port', '4310']);
    const serveArgs = parseCliArgs(['serve', '--port=4311']);

    expect(args.command).toBe('daemon');
    expect(args.port).toBe(4310);
    expect(serveArgs.command).toBe('serve');
    expect(serveArgs.port).toBe(4311);
  });
});

describe('Repo task tracker', () => {
  it('normalizes active tasks and blocks tasks with unfinished dependencies', () => {
    const dir = tempRepo();
    mkdirSync(join(dir, 'orchestration/tasks'), { recursive: true });
    writeFileSync(join(dir, 'orchestration/tasks/codegen.yaml'), `id: task-codegen
identifier: ISO-101
title: Codegen hardening
description: Expand codegen.
priority: 1
state: ready
labels: [codegen, worker-a]
branch_name: feature/codegen
verification_commands:
  - npm test -- --run tests/codegen.test.ts
`);
    writeFileSync(join(dir, 'orchestration/tasks/metrics.yaml'), `id: task-metrics
identifier: ISO-102
title: Metrics hardening
description: Add charts.
priority: 2
state: ready
blocked_by:
  - identifier: ISO-101
    state: ready
`);

    const tasks = loadRepoTasks(join(dir, 'orchestration/tasks'), ['ready'], ['done']);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].identifier).toBe('ISO-101');
    expect(tasks[0].labels).toContain('codegen');
    expect(tasks[1].blocked_by[0].identifier).toBe('ISO-101');
  });
});

describe('Orchestrator dispatch decisions', () => {
  it('respects bounded concurrency, terminal states, and blockers', () => {
    const orchestrator = createOrchestrator({ maxConcurrentAgents: 1, activeStates: ['ready'], terminalStates: ['done'] });
    const decisions = orchestrator.planDispatch([
      { id: '1', identifier: 'ISO-1', title: 'A', description: '', priority: 2, state: 'ready', branch_name: null, url: null, labels: [], blocked_by: [], created_at: null, updated_at: null },
      { id: '2', identifier: 'ISO-2', title: 'B', description: '', priority: 1, state: 'ready', branch_name: null, url: null, labels: [], blocked_by: [{ identifier: 'ISO-1', id: '1', state: 'ready' }], created_at: null, updated_at: null },
      { id: '3', identifier: 'ISO-3', title: 'C', description: '', priority: 0, state: 'done', branch_name: null, url: null, labels: [], blocked_by: [], created_at: null, updated_at: null },
    ]);

    expect(decisions.dispatch.map(issue => issue.identifier)).toEqual(['ISO-1']);
    expect(decisions.blocked.map(issue => issue.identifier)).toEqual(['ISO-2']);
    expect(decisions.ignored.map(issue => issue.identifier)).toEqual(['ISO-3']);
  });
});

describe('Workspace and logging', () => {
  it('sanitizes workspace paths and emits JSONL structured logs', () => {
    const dir = tempRepo();
    const workspace = workspacePathForIssue(dir, 'ISO/101 codegen');
    expect(workspace.endsWith(join('ISO_101_codegen'))).toBe(true);

    const logPath = join(dir, 'events.jsonl');
    const logger = new JsonlLogger(logPath);
    logger.event('dispatch_planned', { issue_identifier: 'ISO-101' });

    const line = readFileSync(logPath, 'utf8').trim();
    expect(JSON.parse(line)).toMatchObject({
      event: 'dispatch_planned',
      issue_identifier: 'ISO-101',
    });
  });
});

describe('Agent runner verification', () => {
  it('runs the configured verification command after the agent exits successfully', async () => {
    const dir = tempRepo();
    const logPath = join(dir, 'events.jsonl');
    const workflow: WorkflowDefinition = {
      promptTemplate: 'Implement {{issue.identifier}}',
      config: {
        tracker: {
          kind: 'repo-tasks',
          tasks_path: 'orchestration/tasks',
          active_states: ['ready'],
          terminal_states: ['done'],
        },
        polling: { interval_ms: 1000 },
        workspace: { root: '.worktrees/symphony' },
        orchestration: {
          max_concurrent_agents: 1,
          max_retries: 1,
          retry_base_delay_ms: 1,
          logs_path: 'artifacts/qa/symphony.jsonl',
        },
        agent: {
          command: 'node -e "process.exit(0)"',
          dry_run: false,
          timeout_ms: 10_000,
        },
        verification: {
          command: 'node -e "require(\'fs\').writeFileSync(\'verified.txt\',\'ok\')"',
          required: true,
        },
        handoff: { summary_path: 'artifacts/qa/handoff.md' },
        server: { port: null },
      },
    };

    const result = await runAgentForIssue({
      issue: { id: '1', identifier: 'ISO-VERIFY', title: 'Verify', description: '', priority: 1, state: 'ready', branch_name: null, url: null, labels: [], blocked_by: [], created_at: null, updated_at: null },
      workflow,
      workspaceRoot: dir,
      logger: new JsonlLogger(logPath),
    });

    expect(result.status).toBe('completed');
    expect(readFileSync(join(result.workspace_path, 'verified.txt'), 'utf8')).toBe('ok');
  });
});

describe('Runtime snapshot store', () => {
  it('builds runtime snapshots with running, retrying, totals, and rate limits', () => {
    const store = createRuntimeStore();
    store.noteRateLimits({
      requests_remaining: 14,
      resets_at: '2026-05-11T10:30:00.000Z',
    });
    store.startRun({
      issue_id: '1',
      issue_identifier: 'ISO-STATE',
      issue_state: 'ready',
      session_id: 'thread-1-turn-1',
      started_at: '2026-05-11T10:00:00.000Z',
      workspace_path: '/tmp/ISO-STATE',
      dry_run: true,
    });
    store.noteRunEvent('ISO-STATE', {
      event: 'turn_completed',
      at: '2026-05-11T10:02:00.000Z',
      message: 'Dry run prompt rendered',
      usage: {
        input_tokens: 120,
        output_tokens: 45,
        total_tokens: 165,
      },
    });
    store.scheduleRetry({
      issue_id: '2',
      issue_identifier: 'ISO-RETRY',
      attempt: 2,
      due_at: '2026-05-11T10:05:00.000Z',
      error: 'no available orchestrator slots',
    });

    const snapshot = store.snapshot('2026-05-11T10:03:00.000Z');

    expect(snapshot.generated_at).toBe('2026-05-11T10:03:00.000Z');
    expect(snapshot.counts).toMatchObject({ running: 1, retrying: 1 });
    expect(snapshot.running[0]).toMatchObject({
      issue_identifier: 'ISO-STATE',
      session_id: 'thread-1-turn-1',
      last_event: 'turn_completed',
      last_message: 'Dry run prompt rendered',
      dry_run: true,
    });
    expect(snapshot.retrying[0]).toMatchObject({
      issue_identifier: 'ISO-RETRY',
      attempt: 2,
    });
    expect(snapshot.codex_totals).toMatchObject({
      input_tokens: 120,
      output_tokens: 45,
      total_tokens: 165,
    });
    expect(snapshot.rate_limits).toMatchObject({
      requests_remaining: 14,
    });
  });
});

describe('Symphony HTTP server extension', () => {
  const closers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (closers.length > 0) {
      const close = closers.pop();
      if (close) await close();
    }
  });

  it('serves the dashboard, state API, issue API, and refresh trigger', async () => {
    const store = createRuntimeStore();
    store.startRun({
      issue_id: '1',
      issue_identifier: 'ISO-DASH',
      issue_state: 'ready',
      session_id: 'thread-9-turn-3',
      started_at: '2026-05-11T11:00:00.000Z',
      workspace_path: '/tmp/ISO-DASH',
      dry_run: false,
    });
    let refreshes = 0;

    const server = await startSymphonyServer({
      port: 0,
      store,
      onRefresh: async () => {
        refreshes += 1;
      },
    });
    closers.push(() => server.close());

    const dashboard = await fetch(`${server.origin}/`);
    const state = await fetch(`${server.origin}/api/v1/state`);
    const issue = await fetch(`${server.origin}/api/v1/ISO-DASH`);
    const refresh = await fetch(`${server.origin}/api/v1/refresh`, { method: 'POST' });

    expect(dashboard.status).toBe(200);
    expect(await dashboard.text()).toContain('Symphony Runtime Dashboard');

    expect(state.status).toBe(200);
    expect(await state.json()).toMatchObject({
      counts: { running: 1, retrying: 0 },
    });

    expect(issue.status).toBe(200);
    expect(await issue.json()).toMatchObject({
      issue_identifier: 'ISO-DASH',
      status: 'running',
      running: { session_id: 'thread-9-turn-3' },
    });

    expect(refresh.status).toBe(202);
    expect(await refresh.json()).toMatchObject({
      accepted: true,
    });
    expect(refreshes).toBe(1);
  }, 15000);
});

describe('Symphony dashboard rendering', () => {
  it('renders operator sections and the state polling client', () => {
    const html = renderDashboardHtml({
      generated_at: '2026-05-11T12:00:00.000Z',
      counts: {
        tasks: 4,
        dispatchable: 2,
        blocked: 1,
        ignored: 1,
        running: 1,
        retrying: 0,
        recent_events: 3,
      },
      running: [{
        issue_id: '1',
        issue_identifier: 'ISO-VIS',
        state: 'ready',
        session_id: 'thread-1-turn-1',
        turn_count: 1,
        last_event: 'turn_completed',
        last_message: 'Rendered dashboard.',
        started_at: '2026-05-11T11:59:00.000Z',
        last_event_at: '2026-05-11T11:59:30.000Z',
        workspace_path: '/tmp/ISO-VIS',
        dry_run: true,
        attempt: 0,
        tokens: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
      }],
      retrying: [],
      codex_totals: {
        input_tokens: 10,
        output_tokens: 4,
        total_tokens: 14,
        seconds_running: 30,
      },
      rate_limits: null,
      dispatchable: [],
      blocked: [],
      ignored: [],
      running_tasks: [{
        issue_id: '1',
        issue_identifier: 'ISO-VIS',
        title: 'Visual dashboard',
        state: 'ready',
        priority: 1,
        labels: ['dashboard'],
        branch_name: 'feature/dashboard',
        blocked_by: [],
        eligibility: 'running',
      }],
      recent_events: [{
        at: '2026-05-11T11:59:30.000Z',
        event: 'turn_completed',
        issue_identifier: 'ISO-VIS',
      }],
      health: {
        status: 'healthy',
        tracker_kind: 'repo-tasks',
        dry_run: true,
        last_poll_at: '2026-05-11T11:59:35.000Z',
        last_poll_ok: true,
        last_error: null,
        server_port: 4318,
        poll_interval_ms: 30000,
        logs_path: '/tmp/symphony.jsonl',
        checks: [{
          name: 'Execution posture',
          status: 'info',
          detail: 'Dry run enabled.',
        }],
      },
      workflow: {
        active_states: ['ready'],
        terminal_states: ['done'],
        workspace_root: '/tmp/workspaces',
        verification_required: true,
        workflow_path: '/tmp/WORKFLOW.md',
      },
      runtime: {
        no_token_spend: true,
        local_setup_commands: ['npm run symphony:serve'],
      },
    });

    expect(html).toContain('Symphony Runtime Dashboard');
    expect(html).toContain('/api/v1/state');
    expect(html).toContain('No token spend');
    expect(html).toContain('Local setup');
  });
});
