export interface LiveSupabaseQaEnv {
  enabled: true;
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
  userA: { email: string; password: string } | null;
  userB: { email: string; password: string } | null;
}

export function loadLocalQaEnv(processEnv?: Record<string, string | undefined>): Record<string, string | undefined>;
export function readLiveSupabaseQaEnv(env?: Record<string, string | undefined>): LiveSupabaseQaEnv;
export function buildLiveQaDiagramPayload(input: {
  userId: string;
  title: string;
  source: string;
  canvasState: string;
  activeDiagramName: string;
}): {
  user_id: string;
  title: string;
  source: string;
  canvas_state: string;
  active_diagram_name: string;
  line_count: number;
};
export function requireInvisibleRows(table: string, rows: unknown[] | null): void;
export function isDatabaseLimitError(error: { code?: string; message?: string } | null | undefined): boolean;
export function runLiveSupabaseContract(options?: {
  env?: Record<string, string | undefined>;
  log?: (name: string, details?: Record<string, unknown>) => Promise<void> | void;
}): Promise<void>;
