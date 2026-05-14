import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Issue, IssueRef } from './types.js';
import { parseSimpleYaml } from './yaml.js';

function normalizeState(state: string) {
  return state.toLowerCase();
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asRefs(value: unknown): IssueRef[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      return {
        id: record.id ? String(record.id) : null,
        identifier: record.identifier ? String(record.identifier) : null,
        state: record.state ? String(record.state) : null,
      };
    }
    return { id: null, identifier: String(item), state: null };
  });
}

function parseBlockedBy(source: string, fallback: unknown): IssueRef[] {
  const match = source.match(/^blocked_by:\s*\n([\s\S]*?)(?=^[A-Za-z_][A-Za-z0-9_]*:|\s*$)/m);
  if (!match) return asRefs(fallback);
  const refs: IssueRef[] = [];
  let current: IssueRef | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^\s*-\s*(\w+):\s*(.+)$/);
    if (item) {
      current = { id: null, identifier: null, state: null };
      refs.push(current);
      (current as any)[item[1]] = item[2].trim();
      continue;
    }
    const prop = line.match(/^\s+(\w+):\s*(.+)$/);
    if (prop && current) (current as any)[prop[1]] = prop[2].trim();
  }
  return refs;
}

export function loadRepoTasks(tasksPath: string, activeStates: string[], terminalStates: string[]): Issue[] {
  if (!existsSync(tasksPath)) return [];
  const allowedStates = new Set([...activeStates, ...terminalStates].map(normalizeState));
  return readdirSync(tasksPath)
    .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
    .map(file => {
      const source = readFileSync(join(tasksPath, file), 'utf8');
      const raw = parseSimpleYaml(source);
      const identifier = String(raw.identifier ?? raw.id ?? file.replace(/\.(ya?ml)$/, ''));
      const issue: Issue = {
        id: String(raw.id ?? identifier),
        identifier,
        title: String(raw.title ?? identifier),
        description: raw.description ? String(raw.description) : null,
        priority: typeof raw.priority === 'number' ? raw.priority : null,
        state: String(raw.state ?? 'ready'),
        branch_name: raw.branch_name ? String(raw.branch_name) : null,
        url: raw.url ? String(raw.url) : null,
        labels: asList(raw.labels).map(label => label.toLowerCase()),
        blocked_by: parseBlockedBy(source, raw.blocked_by),
        created_at: raw.created_at ? String(raw.created_at) : null,
        updated_at: raw.updated_at ? String(raw.updated_at) : null,
        verification_commands: asList(raw.verification_commands),
      };
      return issue;
    })
    .filter(issue => allowedStates.has(normalizeState(issue.state)))
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || a.identifier.localeCompare(b.identifier));
}
