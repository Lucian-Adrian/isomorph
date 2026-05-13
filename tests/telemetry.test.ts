import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTelemetryEvent,
  configureTelemetryQueue,
  flushTelemetryQueue,
  getTelemetryQueueHealth,
  logTelemetry,
  sanitizeTelemetryPayload,
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
  vi.useFakeTimers();
  supabaseMock.from.mockReset();
  configureTelemetryQueue({ maxAttempts: 3, retryBaseMs: 10, maxBatchSize: 10, maxQueueSize: 100, debounceMs: 1 });
});

describe('telemetry privacy and batching', () => {
  it('redacts sensitive payload keys before events are persisted', () => {
    expect(
      sanitizeTelemetryPayload({
        action: 'save',
        password: 'secret',
        source: 'diagram Private : class {}',
        nested: { access_token: 'token', ok: true },
      }),
    ).toEqual({
      action: 'save',
      password: '[redacted]',
      source: '[redacted]',
      nested: { access_token: '[redacted]', ok: true },
    });

    expect(buildTelemetryEvent('save', { source: 'private' }).payload.source).toBe('[redacted]');
  });

  it('batches telemetry, retries Supabase result errors, and stays silent', async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: new Error('network down') })
      .mockResolvedValueOnce({ error: null });
    supabaseMock.from.mockReturnValue({ insert });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await logTelemetry({ userId: 'u1', eventType: 'copy', payload: { source: 'private', copied_chars: 10 } });
    await vi.advanceTimersByTimeAsync(2);
    await vi.advanceTimersByTimeAsync(20);

    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0][0].payload.source).toBe('[redacted]');
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it('exposes queue health without exposing network errors to UI', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    supabaseMock.from.mockReturnValue({ insert });

    await logTelemetry({ eventType: 'export', payload: { format: 'svg' } });
    expect(getTelemetryQueueHealth().queued).toBeGreaterThanOrEqual(1);
    await flushTelemetryQueue();
    expect(getTelemetryQueueHealth()).toMatchObject({ queued: 0, flushing: false });
  });
});
