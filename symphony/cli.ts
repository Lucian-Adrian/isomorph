import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadWorkflow } from './workflow.js';
import { loadRepoTasks } from './repo-task-tracker.js';
import { createOrchestrator } from './orchestrator.js';
import { JsonlLogger } from './logger.js';
import { runAgentForIssue } from './agent-runner.js';

function commandArg() {
  return process.argv[2] ?? 'check';
}

function repoPath(path: string) {
  return resolve(process.cwd(), path);
}

async function loadRuntime() {
  const workflow = loadWorkflow(repoPath('WORKFLOW.md'));
  if (workflow.config.tracker.kind !== 'repo-tasks') {
    throw new Error(`Unsupported tracker kind for v1: ${workflow.config.tracker.kind}`);
  }
  const tasks = loadRepoTasks(
    repoPath(workflow.config.tracker.tasks_path),
    workflow.config.tracker.active_states,
    workflow.config.tracker.terminal_states,
  );
  const logger = new JsonlLogger(repoPath(workflow.config.orchestration.logs_path));
  return { workflow, tasks, logger };
}

async function check() {
  const { workflow, tasks } = await loadRuntime();
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
  const { workflow, tasks, logger } = await loadRuntime();
  const orchestrator = createOrchestrator({
    maxConcurrentAgents: workflow.config.orchestration.max_concurrent_agents,
    activeStates: workflow.config.tracker.active_states,
    terminalStates: workflow.config.tracker.terminal_states,
  });
  const plan = orchestrator.planDispatch(tasks);
  logger.event('poll_completed', { tasks: tasks.length, dispatch: plan.dispatch.length, blocked: plan.blocked.length });
  for (const issue of plan.dispatch) {
    logger.event('dispatch_started', { issue_identifier: issue.identifier });
    const result = await runAgentForIssue({
      issue,
      workflow,
      workspaceRoot: repoPath(workflow.config.workspace.root),
      logger,
    });
    logger.event('dispatch_finished', { issue_identifier: issue.identifier, ...result });
  }
  console.log(JSON.stringify({ ran: plan.dispatch.length, dry_run: workflow.config.agent.dry_run }, null, 2));
}

function status() {
  const workflow = loadWorkflow(repoPath('WORKFLOW.md'));
  const logPath = repoPath(workflow.config.orchestration.logs_path);
  const lines = existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split(/\r?\n/).filter(Boolean) : [];
  console.log(JSON.stringify({
    log_path: logPath,
    events: lines.length,
    last_event: lines.length ? JSON.parse(lines[lines.length - 1]) : null,
  }, null, 2));
}

async function daemon() {
  const { workflow } = await loadRuntime();
  await once();
  setInterval(() => {
    once().catch(error => console.error(error));
  }, workflow.config.polling.interval_ms);
}

const command = commandArg();
if (command === 'check') await check();
else if (command === 'once') await once();
else if (command === 'daemon') await daemon();
else if (command === 'status') status();
else {
  console.error(`Unknown Symphony command: ${command}`);
  process.exitCode = 1;
}
