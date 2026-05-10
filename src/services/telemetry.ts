import type { IOMDiagram } from '../semantics/iom.js';
import { countLines } from './limits.js';

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
  | 'full_canvas_exit';

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
  generatedLoc: number;
  timeSplitMs: {
    editing: number;
    diagramming: number;
    other: number;
  };
  counts: {
    copy: number;
    paste: number;
    export: number;
  };
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
    payload: {
      route: currentRoute(),
      occurred_at_client: new Date().toISOString(),
      ...payload,
    },
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
  const timeSplitMs = { editing: 0, diagramming: 0, other: 0 };
  const counts = { copy: 0, paste: 0, export: 0 };
  let generatedLoc = 0;

  for (const event of events) {
    const latencyMs = numberPayload(event.payload, 'latency_ms');
    const durationMs = numberPayload(event.payload, 'duration_ms');

    if (event.event_type === 'codegen') {
      if (latencyMs > 0) compileLatencies.push(latencyMs);
      generatedLoc += numberPayload(event.payload, 'generated_loc') || numberPayload(event.payload, 'generatedCodeLines');
    } else if (event.event_type === 'save') {
      if (latencyMs > 0) saveLatencies.push(latencyMs);
    } else if (event.event_type === 'copy') {
      counts.copy += 1;
    } else if (event.event_type === 'paste') {
      counts.paste += 1;
    } else if (event.event_type === 'export') {
      counts.export += 1;
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
    generatedLoc,
    timeSplitMs,
    counts,
  };
}
