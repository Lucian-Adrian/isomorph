import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadWorkflow } from './workflow.js';
import { loadRepoTasks } from './repo-task-tracker.js';
import { createOrchestrator } from './orchestrator.js';
import { JsonlLogger } from './logger.js';
import { runAgentForIssue } from './agent-runner.js';
import { createRuntimeStore } from './runtime-state.js';
import { startSymphonyServer } from './server.js';
import { buildRuntimeSnapshot } from './dashboard-state.js';

export interface CliArgs {
  command: 'check' | 'once' | 'daemon' | 'serve' | 'status' | 'dashboard';
  port: number | null;
}

export function parseCliArgs(argv = process.argv.slice(2)): CliArgs {
  let command: CliArgs['command'] = 'check';
  let port: number | null = null;
  let sawCommand = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--port') {
      const raw = argv[index + 1];
      if (!raw) throw new Error('missing_port_value');
      port = Number(raw);
      if (!Number.isFinite(port) || port < 0) throw new Error(`invalid_port:${raw}`);
      index += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      const raw = arg.slice('--port='.length);
      port = Number(raw);
      if (!Number.isFinite(port) || port < 0) throw new Error(`invalid_port:${raw}`);
      continue;
    }
    if (!sawCommand && ['check', 'once', 'daemon', 'serve', 'status', 'dashboard'].includes(arg)) {
      command = arg as CliArgs['command'];
      sawCommand = true;
      continue;
    }
    throw new Error(`unknown_argument:${arg}`);
  }

  return { command, port };
}

function repoPath(path: string) {
  return resolve(process.cwd(), path);
}

async function loadRuntime() {
  const workflowPath = repoPath('WORKFLOW.md');
  const workflow = loadWorkflow(workflowPath);
  if (workflow.config.tracker.kind !== 'repo-tasks') {
    throw new Error(`Unsupported tracker kind for v1: ${workflow.config.tracker.kind}`);
  }
  const logger = new JsonlLogger(repoPath(workflow.config.orchestration.logs_path));
  const store = createRuntimeStore();
  store.configure({
    trackerKind: workflow.config.tracker.kind,
    dryRun: workflow.config.agent.dry_run,
    serverPort: workflow.config.server.port,
    pollIntervalMs: workflow.config.polling.interval_ms,
    logsPath: repoPath(workflow.config.orchestration.logs_path),
    activeStates: workflow.config.tracker.active_states,
    terminalStates: workflow.config.tracker.terminal_states,
    workspaceRoot: repoPath(workflow.config.workspace.root),
    verificationRequired: workflow.config.verification.required,
    workflowPath,
  });
  const orchestrator = createOrchestrator({
    maxConcurrentAgents: workflow.config.orchestration.max_concurrent_agents,
    activeStates: workflow.config.tracker.active_states,
    terminalStates: workflow.config.tracker.terminal_states,
  });

  async function runPoll() {
    const tasks = loadRepoTasks(
      repoPath(workflow.config.tracker.tasks_path),
      workflow.config.tracker.active_states,
      workflow.config.tracker.terminal_states,
    );
    const plan = orchestrator.planDispatch(tasks);
    store.setTrackerPlan({
      tasks,
      dispatchable: plan.dispatch,
      blocked: plan.blocked,
      ignored: plan.ignored,
    });
    store.notePoll({ ok: true });
    logger.event('poll_completed', {
      tasks: tasks.length,
      dispatch: plan.dispatch.length,
      blocked: plan.blocked.length,
      ignored: plan.ignored.length,
    });

    for (const issue of plan.dispatch) {
      const startedAt = new Date().toISOString();
      const workspacePath = repoPath(`${workflow.config.workspace.root}/${issue.identifier}`);
      logger.event('dispatch_started', {
        issue_identifier: issue.identifier,
        issue_id: issue.id,
        issue_state: issue.state,
        workspace_path: workspacePath,
        dry_run: workflow.config.agent.dry_run,
      });
      store.startRun({
        issue_id: issue.id,
        issue_identifier: issue.identifier,
        issue_state: issue.state,
        session_id: `${issue.identifier}-${Date.now()}`,
        started_at: startedAt,
        workspace_path: workspacePath,
        dry_run: workflow.config.agent.dry_run,
      });

      const result = await runAgentForIssue({
        issue,
        workflow,
        workspaceRoot: repoPath(workflow.config.workspace.root),
        logger,
      });

      store.noteRunEvent(issue.identifier, {
        event: result.status === 'failed' ? 'dispatch_failed' : 'dispatch_finished',
        at: new Date().toISOString(),
        message: result.error ?? result.status,
      });
      store.finishRun(issue.identifier, {
        at: new Date().toISOString(),
        event: result.status === 'failed' ? 'session_failed' : 'session_finished',
        message: result.error ?? result.status,
      });
      logger.event(result.status === 'failed' ? 'dispatch_failed' : 'dispatch_finished', {
        issue_identifier: issue.identifier,
        issue_id: issue.id,
        issue_state: issue.state,
        ...result,
      });
      orchestrator.release(issue.id);
    }

    return plan;
  }

  return { workflow, logger, store, runPoll };
}

async function check() {
  const workflow = loadWorkflow(repoPath('WORKFLOW.md'));
  const tasks = loadRepoTasks(
    repoPath(workflow.config.tracker.tasks_path),
    workflow.config.tracker.active_states,
    workflow.config.tracker.terminal_states,
  );
  const orchestrator = createOrchestrator({
    maxConcurrentAgents: workflow.config.orchestration.max_concurrent_agents,
    activeStates: workflow.config.tracker.active_states,
    terminalStates: workflow.config.tracker.terminal_states,
  });
  const plan = orchestrator.planDispatch(tasks);
  console.log(JSON.stringify({
    ok: true,
    tracker: workflow.config.tracker.kind,
    tasks: tasks.length,
    dispatchable: plan.dispatch.map(issue => issue.identifier),
    blocked: plan.blocked.map(issue => issue.identifier),
    ignored: plan.ignored.map(issue => issue.identifier),
  }, null, 2));
}

async function once() {
  const runtime = await loadRuntime();
  const plan = await runtime.runPoll();
  console.log(JSON.stringify({
    ran: plan.dispatch.length,
    dry_run: runtime.workflow.config.agent.dry_run,
  }, null, 2));
}

function status() {
  const workflow = loadWorkflow(repoPath('WORKFLOW.md'));
  const logPath = repoPath(workflow.config.orchestration.logs_path);
  const lines = existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split(/\r?\n/).filter(Boolean) : [];
  console.log(JSON.stringify({
    log_path: logPath,
    events: lines.length,
    last_event: lines.length ? JSON.parse(lines[lines.length - 1]) : null,
    state: buildRuntimeSnapshot({
      repoRoot: process.cwd(),
      serverPort: workflow.config.server.port,
    }),
  }, null, 2));
}

async function daemon(port: number | null) {
  const runtime = await loadRuntime();
  const effectivePort = port ?? runtime.workflow.config.server.port ?? 4310;
  runtime.store.configure({
    trackerKind: runtime.workflow.config.tracker.kind,
    dryRun: runtime.workflow.config.agent.dry_run,
    serverPort: effectivePort,
    pollIntervalMs: runtime.workflow.config.polling.interval_ms,
    logsPath: repoPath(runtime.workflow.config.orchestration.logs_path),
    activeStates: runtime.workflow.config.tracker.active_states,
    terminalStates: runtime.workflow.config.tracker.terminal_states,
    workspaceRoot: repoPath(runtime.workflow.config.workspace.root),
    verificationRequired: runtime.workflow.config.verification.required,
    workflowPath: repoPath('WORKFLOW.md'),
  });
  const server = await startSymphonyServer({
    port: effectivePort,
    repoRoot: process.cwd(),
    workflowPath: 'WORKFLOW.md',
    store: runtime.store,
    onRefresh: async () => {
      await runtime.runPoll();
    },
  });

  console.log(JSON.stringify({
    ok: true,
    dashboard_url: server.origin,
    api_url: `${server.origin}/api/v1/state`,
    dry_run: runtime.workflow.config.agent.dry_run,
  }, null, 2));

  await runtime.runPoll();
  const interval = setInterval(() => {
    runtime.runPoll().catch(error => console.error(error));
  }, runtime.workflow.config.polling.interval_ms);

  process.on('SIGINT', async () => {
    clearInterval(interval);
    await server.close();
    process.exit(0);
  });
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseCliArgs(argv);
  if (args.command === 'check') await check();
  else if (args.command === 'once') await once();
  else if (args.command === 'daemon' || args.command === 'serve' || args.command === 'dashboard') await daemon(args.port);
  else if (args.command === 'status') status();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
