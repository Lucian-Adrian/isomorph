import { spawn } from 'node:child_process';
import type { Issue, WorkflowDefinition } from './types.js';
import { ensureWorkspace } from './workspace.js';
import { JsonlLogger } from './logger.js';

function renderPrompt(template: string, issue: Issue, attempt: number): string {
  return template
    .replaceAll('{{issue.identifier}}', issue.identifier)
    .replaceAll('{{issue.title}}', issue.title)
    .replaceAll('{{issue.description}}', issue.description ?? '')
    .replaceAll('{{attempt}}', String(attempt));
}

function runShellCommand(input: {
  command: string;
  cwd: string;
  timeoutMs: number;
}): Promise<{ ok: boolean; code: number | null; error?: string }> {
  return new Promise(resolve => {
    const child = spawn(input.command, [], {
      cwd: input.cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => {
      child.kill();
      resolve({ ok: false, code: null, error: 'command_timeout' });
    }, input.timeoutMs);
    child.on('exit', code => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, code });
    });
    child.on('error', error => {
      clearTimeout(timeout);
      resolve({ ok: false, code: null, error: error.message });
    });
  });
}

export async function runAgentForIssue(input: {
  issue: Issue;
  workflow: WorkflowDefinition;
  workspaceRoot: string;
  logger: JsonlLogger;
  attempt?: number;
}): Promise<{ status: 'dry_run' | 'completed' | 'failed'; workspace_path: string; error?: string }> {
  const attempt = input.attempt ?? 0;
  const workspace = ensureWorkspace(input.workspaceRoot, input.issue.identifier);
  const prompt = renderPrompt(input.workflow.promptTemplate, input.issue, attempt);
  input.logger.event('agent_prompt_rendered', {
    issue_identifier: input.issue.identifier,
    workspace_path: workspace.path,
    prompt_length: prompt.length,
    dry_run: input.workflow.config.agent.dry_run,
  });

  if (input.workflow.config.agent.dry_run) {
    return { status: 'dry_run', workspace_path: workspace.path };
  }

  return new Promise(resolve => {
    const child = spawn(input.workflow.config.agent.command, [], {
      cwd: workspace.path,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const timeout = setTimeout(() => {
      child.kill();
      resolve({ status: 'failed', workspace_path: workspace.path, error: 'agent_timeout' });
    }, input.workflow.config.agent.timeout_ms);

    child.stdin.write(prompt);
    child.stdin.end();
    child.on('exit', code => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({ status: 'failed', workspace_path: workspace.path, error: `agent_exit_${code}` });
        return;
      }
      const verification = input.workflow.config.verification;
      if (!verification?.command) {
        resolve({ status: 'completed', workspace_path: workspace.path });
        return;
      }
      input.logger.event('verification_started', {
        issue_identifier: input.issue.identifier,
        command: verification.command,
      });
      runShellCommand({
        command: verification.command,
        cwd: workspace.path,
        timeoutMs: input.workflow.config.agent.timeout_ms,
      }).then(result => {
        input.logger.event(result.ok ? 'verification_completed' : 'verification_failed', {
          issue_identifier: input.issue.identifier,
          code: result.code,
          error: result.error,
        });
        resolve(result.ok || !verification.required
          ? { status: 'completed', workspace_path: workspace.path }
          : { status: 'failed', workspace_path: workspace.path, error: result.error ?? `verification_exit_${result.code}` });
      });
    });
    child.on('error', error => {
      clearTimeout(timeout);
      resolve({ status: 'failed', workspace_path: workspace.path, error: error.message });
    });
  });
}
