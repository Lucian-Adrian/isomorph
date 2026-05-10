import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function sanitizeWorkspaceKey(identifier: string): string {
  return identifier.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

export function workspacePathForIssue(root: string, identifier: string): string {
  return resolve(root, sanitizeWorkspaceKey(identifier));
}

export function ensureWorkspace(root: string, identifier: string): { path: string; created_now: boolean } {
  const path = workspacePathForIssue(root, identifier);
  let created_now = false;
  try {
    mkdirSync(path, { recursive: false });
    created_now = true;
  } catch {
    mkdirSync(path, { recursive: true });
  }
  return { path, created_now };
}
