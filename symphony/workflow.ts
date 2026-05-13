import { readFileSync } from 'node:fs';
import type { WorkflowConfig, WorkflowDefinition } from './types.js';
import { parseSimpleYaml } from './yaml.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringList(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.map(String) : fallback;
}

export function normalizeConfig(raw: Record<string, unknown>): WorkflowConfig {
  const tracker = asRecord(raw.tracker);
  const polling = asRecord(raw.polling);
  const workspace = asRecord(raw.workspace);
  const agent = asRecord(raw.agent);
  const orchestration = asRecord(raw.orchestration);
  const verification = asRecord(raw.verification);
  const handoff = asRecord(raw.handoff);
  const server = asRecord(raw.server);

  return {
    tracker: {
      kind: asString(tracker.kind, 'repo-tasks') as WorkflowConfig['tracker']['kind'],
      tasks_path: asString(tracker.tasks_path, 'orchestration/tasks'),
      active_states: asStringList(tracker.active_states, ['ready', 'in progress']),
      terminal_states: asStringList(tracker.terminal_states, ['done', 'cancelled']),
    },
    polling: {
      interval_ms: asNumber(polling.interval_ms, 30000),
    },
    workspace: {
      root: asString(workspace.root, '.worktrees/symphony'),
    },
    agent: {
      command: asString(agent.command, 'codex'),
      dry_run: asBoolean(agent.dry_run, true),
      timeout_ms: asNumber(agent.timeout_ms, 3600000),
    },
    orchestration: {
      max_concurrent_agents: asNumber(orchestration.max_concurrent_agents, 1),
      max_retries: asNumber(orchestration.max_retries, 2),
      retry_base_delay_ms: asNumber(orchestration.retry_base_delay_ms, 30000),
      logs_path: asString(orchestration.logs_path, 'artifacts/qa/symphony.jsonl'),
    },
    verification: {
      command: asString(verification.command, 'npm run verify'),
      required: asBoolean(verification.required, true),
    },
    handoff: {
      summary_path: asString(handoff.summary_path, 'artifacts/qa/handoff.md'),
    },
    server: {
      port: typeof server.port === 'number' && Number.isFinite(server.port) ? server.port : null,
    },
  };
}

export function loadWorkflow(path = 'WORKFLOW.md'): WorkflowDefinition {
  const source = readFileSync(path, 'utf8');
  let configSource = '';
  let promptTemplate = source.trim();

  if (source.startsWith('---')) {
    const end = source.indexOf('\n---', 3);
    if (end === -1) throw new Error('invalid_workflow_front_matter');
    configSource = source.slice(3, end).trim();
    promptTemplate = source.slice(end + 4).trim();
  }

  return {
    config: normalizeConfig(configSource ? parseSimpleYaml(configSource) : {}),
    promptTemplate,
  };
}
