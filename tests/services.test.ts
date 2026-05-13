import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkFileLineLimit, checkUserFileLimit, countLines, LIMIT_CONTACT_EMAIL } from '../src/services/limits.js';
import { buildDiagramPayload, getDiagramListPage, logTelemetry, normalizeDiagramTitle } from '../src/services/diagramStore.js';
import { resolveAuthState } from '../src/services/supabase.js';
import {
  aggregateTelemetryMetrics,
  buildTelemetryEvent,
  buildTelemetrySessionEnd,
  buildTelemetrySessionStart,
  summarizeProductivity,
} from '../src/services/telemetry.js';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('../src/services/supabase.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/supabase.js')>();
  return {
    ...actual,
    supabase: supabaseMock,
  };
});

beforeEach(() => {
  vi.useRealTimers();
  supabaseMock.from.mockReset();
});

describe('Supabase auth state', () => {
  it('classifies unconfigured, signed-out, and signed-in states', () => {
    expect(resolveAuthState(null, false)).toEqual({ status: 'unconfigured', user: null });
    expect(resolveAuthState(null, true)).toEqual({ status: 'signed_out', user: null });
    expect(resolveAuthState({ id: 'user-1' }, true)).toEqual({ status: 'signed_in', user: { id: 'user-1' } });
  });
});

describe('Supabase save limits', () => {
  it('enforces 1000 lines per file with contact path', () => {
    expect(countLines('a\nb\nc')).toBe(3);
    const result = checkFileLineLimit(Array.from({ length: 1001 }, () => 'line').join('\n'));
    expect(result.ok).toBe(false);
    expect(result.message).toContain(LIMIT_CONTACT_EMAIL);
  });

  it('enforces 20 files for new saves but allows updating existing files', () => {
    expect(checkUserFileLimit(20, false).ok).toBe(false);
    expect(checkUserFileLimit(20, true).ok).toBe(true);
  });

  it('returns clear file limit errors with the attempted count', () => {
    const result = checkUserFileLimit(20, false);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('20 saved files');
    expect(result.message).toContain('attempted save would create file 21');
  });
});

describe('diagram service payloads', () => {
  it('normalizes titles and trims service-level payload fields', () => {
    expect(normalizeDiagramTitle('  ')).toBe('Untitled diagram');
    expect(normalizeDiagramTitle('  Class map  ')).toBe('Class map');

    expect(
      buildDiagramPayload({
        userId: 'user-1',
        title: '  Class map  ',
        source: 'a\nb',
        canvasState: undefined,
        activeDiagramName: '  domain  ',
      }),
    ).toEqual({
      user_id: 'user-1',
      title: 'Class map',
      source: 'a\nb',
      canvas_state: null,
      active_diagram_name: 'domain',
      line_count: 2,
    });
  });

  it('bounds list pagination so reads cannot request unbounded result sets', () => {
    expect(getDiagramListPage()).toEqual({ from: 0, to: 19, limit: 20 });
    expect(getDiagramListPage({ page: 2, limit: 10 })).toEqual({ from: 10, to: 19, limit: 10 });
    expect(() => getDiagramListPage({ page: 0 })).toThrow('Page must be at least 1');
    expect(() => getDiagramListPage({ limit: 101 })).toThrow('List limit must be between 1 and 100 diagrams');
  });
});

describe('telemetry payloads', () => {
  it('builds append-only action events with session ids and productivity summaries', () => {
    const event = buildTelemetryEvent('codegen', { language: 'python', latency_ms: 42 }, 'diagram-1', 'session-1');
    expect(event.event_type).toBe('codegen');
    expect(event.session_id).toBe('session-1');
    expect(event.payload.latency_ms).toBe(42);

    const summary = summarizeProductivity('diagram D : class {\n  class A {}\n}', null, 'class A:\n    pass\n');
    expect(summary.lineCount).toBe(3);
    expect(summary.generatedCodeLines).toBe(3);
    expect(summary.estimatedBoilerplateMinutesSaved).toBeGreaterThan(0);
  });

  it('builds session lifecycle payloads and aggregates telemetry metrics', () => {
    const session = buildTelemetrySessionStart('user-1', '/app/#class', { viewport: 'desktop' });
    expect(session).toMatchObject({
      user_id: 'user-1',
      route: '/app/#class',
      device: { viewport: 'desktop' },
    });
    expect(session.started_at).toMatch(/\d{4}-\d{2}-\d{2}T/);

    expect(buildTelemetrySessionEnd()).toHaveProperty('ended_at');

    expect(
      aggregateTelemetryMetrics([
        { event_type: 'codegen', payload: { latency_ms: 50, generated_loc: 12 } },
        { event_type: 'save', payload: { latency_ms: 30 } },
        { event_type: 'copy', payload: {} },
        { event_type: 'paste', payload: {} },
        { event_type: 'export', payload: {} },
        { event_type: 'editor_typing', payload: { duration_ms: 1000 } },
        { event_type: 'diagram_drag', payload: { duration_ms: 3000 } },
      ]),
    ).toEqual({
      averageCompileLatencyMs: 50,
      averageSaveLatencyMs: 30,
      averageParseLatencyMs: 0,
      averageAnalyzeLatencyMs: 0,
      averageRenderLatencyMs: 0,
      generatedLoc: 12,
      estimatedBoilerplateMinutesSaved: 0,
      linesModifiedPerMinute: 0,
      editsPerMinute: 15,
      timeSplitMs: {
        editing: 1000,
        diagramming: 3000,
        other: 0,
      },
      counts: {
        copy: 1,
        paste: 1,
        export: 1,
        codegen: 1,
        save: 1,
      },
      canvasToolUsage: {},
    });
  });
});

describe('telemetry service persistence', () => {
  it('resolves even when Supabase rejects a telemetry insert', async () => {
    vi.useFakeTimers();
    const insert = vi.fn().mockRejectedValue(new Error('network down'));
    supabaseMock.from.mockReturnValue({ insert });

    await expect(
      logTelemetry({
        userId: 'user-1',
        sessionId: 'session-1',
        eventType: 'copy',
        payload: { source: 'shortcut' },
      }),
    ).resolves.toBeUndefined();
    await vi.runAllTimersAsync();

    expect(insert).toHaveBeenCalledTimes(3);
  });
});
