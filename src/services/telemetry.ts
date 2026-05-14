import type { IOMDiagram } from '../semantics/iom.js';
import { countLines } from './limits.js';
import { supabase } from './supabase.js';

export type TelemetryEventType =
  | 'auth'
  | 'open'
  | 'save'
  | 'load'
  | 'export'
  | 'codegen'
  | 'copy'
  | 'paste'
  | 'editor_typing'
  | 'diagram_drag'
  | 'relation_edit'
  | 'component_edit'
  | 'route_switch'
  | 'full_canvas_entry'
  | 'full_canvas_exit'
  | 'parse'
  | 'analyze'
  | 'render'
  | 'canvas_tool'
  | 'collaboration';

export interface TelemetryEventPayload {
  event_type: TelemetryEventType;
  session_id?: string;
  diagram_id?: string;
  payload: Record<string, unknown>;
}

export interface TelemetrySessionStartPayload {
  user_id: string | null;
  route: string;
  device: Record<string, unknown>;
  started_at: string;
}

export interface TelemetrySessionEndPayload {
  ended_at: string;
}

export interface ProductivitySnapshot {
  lineCount: number;
  entityCount: number;
  relationCount: number;
  generatedCodeLines?: number;
  estimatedBoilerplateMinutesSaved?: number;
}

export interface TelemetryMetricEvent {
  event_type: TelemetryEventType;
  payload: Record<string, unknown>;
}

export interface TelemetryMetrics {
  averageCompileLatencyMs: number;
  averageSaveLatencyMs: number;
  averageParseLatencyMs: number;
  averageAnalyzeLatencyMs: number;
  averageRenderLatencyMs: number;
  generatedLoc: number;
  estimatedBoilerplateMinutesSaved: number;
  linesModifiedPerMinute: number;
  editsPerMinute: number;
  timeSplitMs: {
    editing: number;
    diagramming: number;
    other: number;
  };
  counts: {
    copy: number;
    paste: number;
    export: number;
    codegen: number;
    save: number;
  };
  canvasToolUsage: Record<string, number>;
}

function currentRoute(): string {
  return typeof window !== 'undefined' ? window.location.pathname + window.location.hash : '/app/';
}

function numberPayload(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

const SENSITIVE_PAYLOAD_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'source',
  'raw_source',
  'diagram_source',
  'code',
  'generated_code',
  'private_text',
]);

function sanitizeTelemetryValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 25).map(item => sanitizeTelemetryValue(item, depth + 1));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_PAYLOAD_KEYS.has(key.toLowerCase())) {
        output[key] = '[redacted]';
      } else {
        output[key] = sanitizeTelemetryValue(nested, depth + 1);
      }
    }
    return output;
  }
  return String(value);
}

export function sanitizeTelemetryPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return sanitizeTelemetryValue(payload) as Record<string, unknown>;
}

export function buildTelemetryEvent(
  event_type: TelemetryEventType,
  payload: Record<string, unknown> = {},
  diagram_id?: string,
  session_id?: string,
): TelemetryEventPayload {
  return {
    event_type,
    session_id,
    diagram_id,
    payload: sanitizeTelemetryPayload({
      route: currentRoute(),
      occurred_at_client: new Date().toISOString(),
      ...payload,
    }),
  };
}

export function buildTelemetrySessionStart(
  userId?: string | null,
  route = currentRoute(),
  device: Record<string, unknown> = {},
): TelemetrySessionStartPayload {
  return {
    user_id: userId ?? null,
    route,
    device,
    started_at: new Date().toISOString(),
  };
}

export function buildTelemetrySessionEnd(): TelemetrySessionEndPayload {
  return {
    ended_at: new Date().toISOString(),
  };
}

export function summarizeProductivity(source: string, diagram?: IOMDiagram | null, generatedCode?: string): ProductivitySnapshot {
  const generatedCodeLines = generatedCode ? countLines(generatedCode) : undefined;
  return {
    lineCount: countLines(source),
    entityCount: diagram?.entities.size ?? 0,
    relationCount: diagram?.relations.length ?? 0,
    generatedCodeLines,
    estimatedBoilerplateMinutesSaved: generatedCodeLines ? Math.round(generatedCodeLines * 0.45) : undefined,
  };
}

export function aggregateTelemetryMetrics(events: TelemetryMetricEvent[]): TelemetryMetrics {
  const compileLatencies: number[] = [];
  const saveLatencies: number[] = [];
  const parseLatencies: number[] = [];
  const analyzeLatencies: number[] = [];
  const renderLatencies: number[] = [];
  const timeSplitMs = { editing: 0, diagramming: 0, other: 0 };
  const counts = { copy: 0, paste: 0, export: 0, codegen: 0, save: 0 };
  const canvasToolUsage: Record<string, number> = {};
  let generatedLoc = 0;
  let estimatedBoilerplateMinutesSaved = 0;
  let linesModified = 0;
  let editCount = 0;
  let activeDurationMs = 0;

  for (const event of events) {
    const latencyMs = numberPayload(event.payload, 'latency_ms');
    const durationMs = numberPayload(event.payload, 'duration_ms');
    activeDurationMs += durationMs;

    if (event.event_type === 'codegen') {
      counts.codegen += 1;
      if (latencyMs > 0) compileLatencies.push(latencyMs);
      generatedLoc += numberPayload(event.payload, 'generated_loc') || numberPayload(event.payload, 'generatedCodeLines');
      estimatedBoilerplateMinutesSaved += numberPayload(event.payload, 'estimated_minutes_saved');
    } else if (event.event_type === 'save') {
      counts.save += 1;
      if (latencyMs > 0) saveLatencies.push(latencyMs);
    } else if (event.event_type === 'parse') {
      if (latencyMs > 0) parseLatencies.push(latencyMs);
    } else if (event.event_type === 'analyze') {
      if (latencyMs > 0) analyzeLatencies.push(latencyMs);
    } else if (event.event_type === 'render') {
      if (latencyMs > 0) renderLatencies.push(latencyMs);
    } else if (event.event_type === 'copy') {
      counts.copy += 1;
    } else if (event.event_type === 'paste') {
      counts.paste += 1;
    } else if (event.event_type === 'export') {
      counts.export += 1;
    } else if (event.event_type === 'canvas_tool') {
      const tool = typeof event.payload.tool === 'string' ? event.payload.tool : 'unknown';
      canvasToolUsage[tool] = (canvasToolUsage[tool] || 0) + 1;
    }

    linesModified += numberPayload(event.payload, 'lines_modified');
    if (event.event_type === 'editor_typing' || event.event_type === 'relation_edit' || event.event_type === 'component_edit') {
      editCount += 1;
    }

    if (event.event_type === 'editor_typing') {
      timeSplitMs.editing += durationMs;
    } else if (
      event.event_type === 'diagram_drag' ||
      event.event_type === 'relation_edit' ||
      event.event_type === 'component_edit' ||
      event.event_type === 'full_canvas_entry'
    ) {
      timeSplitMs.diagramming += durationMs;
    } else {
      timeSplitMs.other += durationMs;
    }
  }

  return {
    averageCompileLatencyMs: average(compileLatencies),
    averageSaveLatencyMs: average(saveLatencies),
    averageParseLatencyMs: average(parseLatencies),
    averageAnalyzeLatencyMs: average(analyzeLatencies),
    averageRenderLatencyMs: average(renderLatencies),
    generatedLoc,
    estimatedBoilerplateMinutesSaved,
    linesModifiedPerMinute: activeDurationMs > 0 ? Math.round(linesModified / (activeDurationMs / 60000)) : 0,
    editsPerMinute: activeDurationMs > 0 ? Math.round(editCount / (activeDurationMs / 60000)) : 0,
    timeSplitMs,
    counts,
    canvasToolUsage,
  };
}

interface TelemetryInsert {
  user_id: string | null;
  session_id: string | null;
  diagram_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
}

interface QueuedTelemetryInsert {
  payload: TelemetryInsert;
  attempts: number;
}

export interface TelemetryQueueOptions {
  maxAttempts?: number;
  retryBaseMs?: number;
  maxBatchSize?: number;
  maxQueueSize?: number;
  debounceMs?: number;
}

export interface TelemetryQueueHealth {
  queued: number;
  flushing: boolean;
  dropped: number;
}

const DEFAULT_QUEUE_OPTIONS: Required<TelemetryQueueOptions> = {
  maxAttempts: 3,
  retryBaseMs: 250,
  maxBatchSize: 25,
  maxQueueSize: 500,
  debounceMs: 150,
};

const telemetryQueue: QueuedTelemetryInsert[] = [];
let telemetryOptions = DEFAULT_QUEUE_OPTIONS;
let telemetryFlushScheduled = false;
let telemetryFlushing = false;
let droppedTelemetryEvents = 0;

export function configureTelemetryQueue(options: TelemetryQueueOptions = {}): void {
  telemetryOptions = { ...telemetryOptions, ...options };
}

export function getTelemetryQueueHealth(): TelemetryQueueHealth {
  return {
    queued: telemetryQueue.length,
    flushing: telemetryFlushing,
    dropped: droppedTelemetryEvents,
  };
}

function scheduleTelemetryFlush(delayMs = telemetryOptions.debounceMs): void {
  if (telemetryFlushScheduled) return;
  telemetryFlushScheduled = true;
  globalThis.setTimeout(() => {
    telemetryFlushScheduled = false;
    void flushTelemetryQueue();
  }, delayMs);
}

export async function flushTelemetryQueue(): Promise<void> {
  if (!supabase || telemetryFlushing || telemetryQueue.length === 0) return;
  telemetryFlushing = true;
  const batch = telemetryQueue.splice(0, telemetryOptions.maxBatchSize);

  try {
    const result = await supabase.from('telemetry_events').insert(batch.map(entry => entry.payload));
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      throw result.error;
    }
  } catch {
    const retryable = batch
      .filter(entry => entry.attempts + 1 < telemetryOptions.maxAttempts)
      .map(entry => ({ ...entry, attempts: entry.attempts + 1 }));
    droppedTelemetryEvents += batch.length - retryable.length;
    telemetryQueue.unshift(...retryable);
  } finally {
    telemetryFlushing = false;
  }

  if (telemetryQueue.length > 0) {
    const nextAttempt = Math.max(...telemetryQueue.map(entry => entry.attempts));
    scheduleTelemetryFlush(telemetryOptions.retryBaseMs * 2 ** Math.max(0, nextAttempt - 1));
  }
}

export async function logTelemetry(input: {
  userId?: string;
  sessionId?: string;
  eventType: string;
  diagramId?: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  if (!supabase) return;
  if (telemetryQueue.length >= telemetryOptions.maxQueueSize) {
    telemetryQueue.shift();
    droppedTelemetryEvents += 1;
  }
  telemetryQueue.push({
    attempts: 0,
    payload: {
      user_id: input.userId ?? null,
      session_id: input.sessionId ?? null,
      diagram_id: input.diagramId ?? null,
      event_type: input.eventType,
      payload: sanitizeTelemetryPayload(input.payload),
    },
  });
  scheduleTelemetryFlush();
}
