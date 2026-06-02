import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appSource = readFileSync(resolve(repoRoot, 'src/App.tsx'), 'utf8');

describe('App telemetry instrumentation', () => {
  it('emits parse, analyze, and render telemetry instead of keeping compile timing local-only', () => {
    for (const eventType of ['parse', 'analyze', 'render']) {
      expect(appSource).toContain(`eventType: '${eventType}'`);
      expect(appSource).toContain(`buildTelemetryEvent('${eventType}'`);
    }
  });

  it('records editor typing elapsed time and line deltas instead of zero-duration edits', () => {
    expect(appSource).not.toContain("buildTelemetryEvent('editor_typing', { delta_chars: value.length - previousLength, duration_ms: 0 })");
    expect(appSource).toContain('typingTimingRef');
    expect(appSource).toContain('lines_modified');
  });
});
