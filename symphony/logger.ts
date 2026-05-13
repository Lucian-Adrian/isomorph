import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class JsonlLogger {
  constructor(private readonly path: string) {}

  event(event: string, payload: Record<string, unknown> = {}) {
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, JSON.stringify({
      at: new Date().toISOString(),
      event,
      ...payload,
    }) + '\n');
  }

  recent(limit = 50): Array<Record<string, unknown>> {
    if (!existsSync(this.path)) return [];
    const lines = readFileSync(this.path, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-Math.max(1, limit));
    return lines
      .map(line => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is Record<string, unknown> => entry !== null);
  }
}
