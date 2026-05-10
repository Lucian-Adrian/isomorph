import { appendFileSync, mkdirSync } from 'node:fs';
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
}
