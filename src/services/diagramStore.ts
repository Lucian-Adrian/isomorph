import type { User } from '@supabase/supabase-js';
import { checkFileLineLimit, checkUserFileLimit, countLines } from './limits.js';
import { supabase } from './supabase.js';
import { buildTelemetrySessionEnd, buildTelemetrySessionStart } from './telemetry.js';

export interface SavedDiagram {
  id: string;
  user_id: string;
  title: string;
  source: string;
  canvas_state: string | null;
  active_diagram_name: string | null;
  line_count: number;
  updated_at: string;
  created_at: string;
}

export interface DiagramPayloadInput {
  userId: string;
  title: string;
  source: string;
  canvasState?: string | null;
  activeDiagramName?: string | null;
}

export interface DiagramListOptions {
  page?: number;
  limit?: number;
}

export const DEFAULT_DIAGRAM_LIST_LIMIT = 20;
export const MAX_DIAGRAM_LIST_LIMIT = 100;

export function normalizeDiagramTitle(title: string): string {
  const normalized = title.trim();
  return normalized.length > 0 ? normalized : 'Untitled diagram';
}

function normalizeNullableText(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildDiagramPayload(input: DiagramPayloadInput) {
  return {
    user_id: input.userId,
    title: normalizeDiagramTitle(input.title),
    source: input.source,
    canvas_state: input.canvasState ?? null,
    active_diagram_name: normalizeNullableText(input.activeDiagramName),
    line_count: countLines(input.source),
  };
}

export function getDiagramListPage(options: DiagramListOptions = {}) {
  const page = options.page ?? 1;
  const limit = options.limit ?? DEFAULT_DIAGRAM_LIST_LIMIT;
  if (!Number.isInteger(page) || page < 1) throw new Error('Page must be at least 1.');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DIAGRAM_LIST_LIMIT) {
    throw new Error(`List limit must be between 1 and ${MAX_DIAGRAM_LIST_LIMIT} diagrams.`);
  }
  const from = (page - 1) * limit;
  return { from, to: from + limit - 1, limit };
}

export async function listDiagrams(user: User, options: DiagramListOptions = {}): Promise<SavedDiagram[]> {
  if (!supabase) return [];
  const { from, to } = getDiagramListPage(options);
  const { data, error } = await supabase
    .from('diagrams')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return data ?? [];
}

export async function saveDiagram(input: {
  user: User;
  title: string;
  source: string;
  canvasState?: string | null;
  activeDiagramName?: string | null;
  existingId?: string;
  currentFileCount: number;
}): Promise<SavedDiagram> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const lineLimit = checkFileLineLimit(input.source);
  if (!lineLimit.ok) throw new Error(lineLimit.message);
  const fileLimit = checkUserFileLimit(input.currentFileCount, Boolean(input.existingId));
  if (!fileLimit.ok) throw new Error(fileLimit.message);

  const payload = buildDiagramPayload({
    userId: input.user.id,
    title: input.title,
    source: input.source,
    canvasState: input.canvasState,
    activeDiagramName: input.activeDiagramName,
  });

  // Duplicate titles are allowed for separate rows. Passing existingId is the explicit update path.
  const query = input.existingId
    ? supabase.from('diagrams').update(payload).eq('id', input.existingId).select('*').single()
    : supabase.from('diagrams').insert(payload).select('*').single();

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function startTelemetrySession(input: {
  userId?: string | null;
  route?: string;
  device?: Record<string, unknown>;
} = {}): Promise<string | null> {
  if (!supabase) return null;
  const payload = buildTelemetrySessionStart(input.userId, input.route, input.device);
  const { data, error } = await supabase.from('telemetry_sessions').insert(payload).select('id').single();
  if (error) throw error;
  return data?.id ?? null;
}

export async function endTelemetrySession(sessionId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('telemetry_sessions').update(buildTelemetrySessionEnd()).eq('id', sessionId);
  if (error) throw error;
}

export async function logTelemetry(input: {
  userId?: string;
  sessionId?: string;
  eventType: string;
  diagramId?: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  if (!supabase) return;
  await supabase.from('telemetry_events').insert({
    user_id: input.userId ?? null,
    session_id: input.sessionId ?? null,
    diagram_id: input.diagramId ?? null,
    event_type: input.eventType,
    payload: input.payload,
  });
}
