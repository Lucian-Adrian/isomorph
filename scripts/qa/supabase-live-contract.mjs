import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const QA_TITLE_PREFIX = 'ISOMORPH_QA_DO_NOT_KEEP';
const LOCAL_ENV_FILES = ['.env', '.env.local'];
const QA_SOURCE = `diagram SupabaseLiveQa : class {
  class Client {
    +save(): void
  }
}
`;
const QA_CANVAS_STATE = JSON.stringify({
  version: 1,
  viewport: { x: 0, y: 0, zoom: 1 },
  activeTool: 'select',
  locked: false,
  selectedElementIds: ['qa-rect'],
  styleDefaults: { stroke: '#1e1e1e', fill: '#ffffff', text: '#1e1e1e', strokeWidth: 2, opacity: 1, roughness: 0 },
  draftSemanticLinks: [{ id: 'draft-qa-rect', canvasElementId: 'qa-rect', targetKind: 'entity', status: 'draft' }],
  elements: [
    {
      id: 'qa-rect',
      kind: 'rectangle',
      layer: 0,
      bounds: { x: 24, y: 32, width: 180, height: 96 },
      style: { stroke: '#1e1e1e', fill: '#ffffff', text: '#1e1e1e', strokeWidth: 2, opacity: 1, roughness: 0 },
      locked: false,
      rotation: 0,
      createdAt: '2026-05-29T00:00:00.000Z',
      updatedAt: '2026-05-29T00:00:00.000Z',
    },
  ],
  updatedAt: '2026-05-29T00:00:00.000Z',
});

function countLines(source) {
  return source.split(/\r\n|\r|\n/).length;
}

function requireEnv(env, key) {
  const value = env[key];
  if (!value || !String(value).trim()) {
    throw new Error(`Live Supabase QA requires ${key}.`);
  }
  return String(value);
}

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r\n|\r|\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const equalsIndex = line.indexOf('=');
        if (equalsIndex === -1) return null;
        const key = line.slice(0, equalsIndex).trim();
        let value = line.slice(equalsIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return key ? [key, value] : null;
      })
      .filter(Boolean),
  );
}

export function loadLocalQaEnv(processEnv = process.env) {
  const fileEnv = LOCAL_ENV_FILES.reduce((merged, path) => ({ ...merged, ...parseEnvFile(path) }), {});
  return { ...fileEnv, ...processEnv };
}

export function readLiveSupabaseQaEnv(env = process.env) {
  const resolvedEnv = env === process.env ? loadLocalQaEnv(env) : env;
  if (env.QA_LIVE_SUPABASE !== '1') {
    throw new Error('Live Supabase QA requires QA_LIVE_SUPABASE=1.');
  }
  const hasProvidedUsers = Boolean(
    resolvedEnv.QA_SUPABASE_USER_A_EMAIL
      || resolvedEnv.QA_SUPABASE_USER_A_PASSWORD
      || resolvedEnv.QA_SUPABASE_USER_B_EMAIL
      || resolvedEnv.QA_SUPABASE_USER_B_PASSWORD,
  );
  return {
    enabled: true,
    url: requireEnv(resolvedEnv, 'VITE_SUPABASE_URL'),
    publishableKey: requireEnv(resolvedEnv, 'VITE_SUPABASE_PUBLISHABLE_KEY'),
    serviceRoleKey: resolvedEnv.QA_SUPABASE_SERVICE_ROLE_KEY || resolvedEnv.SUPABASE_SECRET || '',
    userA: hasProvidedUsers
      ? {
          email: requireEnv(resolvedEnv, 'QA_SUPABASE_USER_A_EMAIL'),
          password: requireEnv(resolvedEnv, 'QA_SUPABASE_USER_A_PASSWORD'),
        }
      : null,
    userB: hasProvidedUsers
      ? {
          email: requireEnv(resolvedEnv, 'QA_SUPABASE_USER_B_EMAIL'),
          password: requireEnv(resolvedEnv, 'QA_SUPABASE_USER_B_PASSWORD'),
        }
      : null,
  };
}

export function buildLiveQaDiagramPayload({ userId, title, source, canvasState, activeDiagramName }) {
  return {
    user_id: userId,
    title,
    source,
    canvas_state: canvasState,
    active_diagram_name: activeDiagramName,
    line_count: countLines(source),
  };
}

export function requireInvisibleRows(table, rows) {
  if (Array.isArray(rows) ? rows.length > 0 : Boolean(rows)) {
    throw new Error(`RLS isolation failed for ${table}: rows were visible across users.`);
  }
}

export function isDatabaseLimitError(error) {
  if (!error) return false;
  const message = String(error.message ?? '');
  return error.code === '23514'
    || /check constraint|violates row-level security|demo limit|line_count|1000|20 saved files/i.test(message);
}

function makeClient(env) {
  return createClient(env.url, env.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function makeAdminClient(env) {
  if (!env.serviceRoleKey) {
    throw new Error(
      'Live Supabase QA requires two QA users or QA_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET to create disposable users.',
    );
  }
  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function createDisposableUsers(env, log) {
  const admin = makeAdminClient(env);
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const password = `IsomorphQa-${randomUUID()}-aA1!`;
  const users = [];

  for (const label of ['a', 'b']) {
    const email = `isomorph-live-qa-${label}-${suffix}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { qa: QA_TITLE_PREFIX },
    });
    if (error) throw new Error(`Could not create disposable QA user ${label.toUpperCase()}: ${error.message}`);
    if (!data.user?.id) throw new Error(`Disposable QA user ${label.toUpperCase()} was created without an id.`);
    users.push({ id: data.user.id, email, password });
  }

  await log('disposable_auth_users_created', { count: users.length });
  return {
    credentials: {
      userA: { email: users[0].email, password },
      userB: { email: users[1].email, password },
    },
    async cleanup() {
      for (const user of users) {
        const { error } = await admin.auth.admin.deleteUser(user.id);
        if (error) {
          console.warn(`[supabase-live] could not delete disposable QA user ${user.id}: ${error.message}`);
        }
      }
    },
  };
}

async function signIn(label, client, credentials) {
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error) throw new Error(`Could not sign in QA user ${label}: ${error.message}`);
  const user = data.user;
  if (!user?.id) throw new Error(`Could not resolve signed-in QA user ${label}.`);
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error(`Could not read signed-in QA user ${label} session: ${sessionError.message}`);
  if (sessionData.session?.user?.id !== user.id || !sessionData.session.access_token) {
    throw new Error(`Signed-in QA user ${label} did not produce a real auth session.`);
  }
  return user;
}

async function deleteQaRows(client) {
  await client.from('telemetry_events').delete().like('payload->>qa_title', `${QA_TITLE_PREFIX}%`);
  await client.from('telemetry_sessions').delete().like('route', `/qa/${QA_TITLE_PREFIX}%`);
  await client.from('diagrams').delete().like('title', `${QA_TITLE_PREFIX}%`);
}

async function selectOwnCount(client) {
  const { count, error } = await client.from('diagrams').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function insertDiagram(client, user, title, overrides = {}) {
  const payload = buildLiveQaDiagramPayload({
    userId: user.id,
    title,
    source: QA_SOURCE,
    canvasState: QA_CANVAS_STATE,
    activeDiagramName: 'SupabaseLiveQa',
    ...overrides,
  });
  const { data, error } = await client.from('diagrams').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

async function proveDiagramPersistenceAndRls(clientA, clientB, userA, log) {
  const saved = await insertDiagram(clientA, userA, `${QA_TITLE_PREFIX}_canvas_persistence`);
  if (saved.canvas_state !== QA_CANVAS_STATE) throw new Error('Saved diagram did not preserve canvas_state text.');
  if (saved.active_diagram_name !== 'SupabaseLiveQa') throw new Error('Saved diagram did not preserve active_diagram_name.');

  const { data: loaded, error: loadError } = await clientA.from('diagrams').select('*').eq('id', saved.id).single();
  if (loadError) throw loadError;
  if (loaded.source !== QA_SOURCE || loaded.canvas_state !== QA_CANVAS_STATE) {
    throw new Error('User A could not load the saved source and canvas_state.');
  }

  const { data: visibleToB, error: bReadError } = await clientB.from('diagrams').select('*').eq('id', saved.id);
  if (bReadError) throw bReadError;
  requireInvisibleRows('diagrams', visibleToB);

  const { data: bUpdateRows, error: bUpdateError } = await clientB
    .from('diagrams')
    .update({ title: `${QA_TITLE_PREFIX}_rls_break_attempt` })
    .eq('id', saved.id)
    .select('id');
  if (bUpdateError && !/row-level security/i.test(String(bUpdateError.message))) throw bUpdateError;
  requireInvisibleRows('diagrams update', bUpdateRows);

  await new Promise(resolve => setTimeout(resolve, 1100));
  const { data: updated, error: updateError } = await clientA
    .from('diagrams')
    .update({ source: `${QA_SOURCE}\n// updated`, line_count: countLines(`${QA_SOURCE}\n// updated`) })
    .eq('id', saved.id)
    .select('*')
    .single();
  if (updateError) throw updateError;
  if (new Date(updated.updated_at).getTime() <= new Date(saved.updated_at).getTime()) {
    throw new Error('diagrams_set_updated_at trigger did not advance updated_at.');
  }
  await log('diagram_persistence_rls_trigger', { diagramId: saved.id });
  return updated;
}

async function proveDatabaseLimits(clientA, userA, log) {
  const tooLongSource = Array.from({ length: 1001 }, (_, index) => `line ${index + 1}`).join('\n');
  const { error: lineLimitError } = await clientA.from('diagrams').insert(buildLiveQaDiagramPayload({
    userId: userA.id,
    title: `${QA_TITLE_PREFIX}_line_limit`,
    source: tooLongSource,
    canvasState: QA_CANVAS_STATE,
    activeDiagramName: 'TooLong',
  }));
  if (!isDatabaseLimitError(lineLimitError)) {
    throw new Error('Expected database line_count check to reject over-1000-line source.');
  }

  const existingCount = await selectOwnCount(clientA);
  const rowsNeeded = Math.max(0, 20 - existingCount);
  const createdIds = [];
  for (let index = 0; index < rowsNeeded; index += 1) {
    const row = await insertDiagram(clientA, userA, `${QA_TITLE_PREFIX}_file_limit_fill_${index}`);
    createdIds.push(row.id);
  }

  const { error: fileLimitError } = await clientA.from('diagrams').insert(buildLiveQaDiagramPayload({
    userId: userA.id,
    title: `${QA_TITLE_PREFIX}_file_limit_21st`,
    source: QA_SOURCE,
    canvasState: QA_CANVAS_STATE,
    activeDiagramName: 'FileLimit',
  }));
  if (!isDatabaseLimitError(fileLimitError)) {
    throw new Error('Expected database file-limit trigger to reject the next new diagram.');
  }

  await log('database_limits', { existingCount, fillRowsCreated: createdIds.length });
}

async function proveTelemetryPersistenceAndRls(clientA, clientB, userA, log) {
  const { data: session, error: sessionError } = await clientA
    .from('telemetry_sessions')
    .insert({ user_id: userA.id, route: `/qa/${QA_TITLE_PREFIX}`, device: { qa: true } })
    .select('*')
    .single();
  if (sessionError) throw sessionError;

  const { data: event, error: eventError } = await clientA
    .from('telemetry_events')
    .insert({
      user_id: userA.id,
      session_id: session.id,
      event_type: 'save',
      payload: { qa_title: `${QA_TITLE_PREFIX}_telemetry`, latency_ms: 1 },
    })
    .select('*')
    .single();
  if (eventError) throw eventError;

  const { data: ended, error: endError } = await clientA
    .from('telemetry_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', session.id)
    .select('*')
    .single();
  if (endError) throw endError;
  if (!ended.ended_at) throw new Error('Telemetry session ended_at was not persisted.');

  const { data: bSessions, error: bSessionError } = await clientB.from('telemetry_sessions').select('*').eq('id', session.id);
  if (bSessionError) throw bSessionError;
  requireInvisibleRows('telemetry_sessions', bSessions);

  const { data: bEvents, error: bEventError } = await clientB.from('telemetry_events').select('*').eq('id', event.id);
  if (bEventError) throw bEventError;
  requireInvisibleRows('telemetry_events', bEvents);

  await log('telemetry_persistence_rls', { sessionId: session.id, eventId: event.id });
}

export async function runLiveSupabaseContract(options = {}) {
  const env = readLiveSupabaseQaEnv(options.env ?? process.env);
  const log = options.log ?? (async (name, details) => {
    console.log(`[supabase-live] ${name}`, JSON.stringify(details ?? {}));
  });
  const disposableUsers = env.userA && env.userB ? null : await createDisposableUsers(env, log);
  const userCredentials = disposableUsers?.credentials ?? { userA: env.userA, userB: env.userB };
  const clientA = makeClient(env);
  const clientB = makeClient(env);
  const userA = await signIn('A', clientA, userCredentials.userA);
  const userB = await signIn('B', clientB, userCredentials.userB);
  if (userA.id === userB.id) throw new Error('Live Supabase QA requires two distinct auth users.');
  await log('auth_state_verified', { userA: userA.id, userB: userB.id });

  try {
    await deleteQaRows(clientA);
    await deleteQaRows(clientB);
    await proveDiagramPersistenceAndRls(clientA, clientB, userA, log);
    await proveDatabaseLimits(clientA, userA, log);
    await proveTelemetryPersistenceAndRls(clientA, clientB, userA, log);
    await log('ok', { userA: userA.id });
  } finally {
    await deleteQaRows(clientA);
    await deleteQaRows(clientB);
    await clientA.auth.signOut().catch(() => {});
    await clientB.auth.signOut().catch(() => {});
    await disposableUsers?.cleanup();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLiveSupabaseContract().catch(error => {
    console.error(`[supabase-live] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
