import { describe, expect, it } from 'vitest';

import {
  buildLiveQaDiagramPayload,
  isDatabaseLimitError,
  readLiveSupabaseQaEnv,
  requireInvisibleRows,
} from '../scripts/qa/supabase-live-contract.mjs';

describe('live Supabase QA contract helpers', () => {
  it('requires live flag, Supabase browser credentials, and two real auth users', () => {
    expect(() => readLiveSupabaseQaEnv({})).toThrow('QA_LIVE_SUPABASE=1');
    expect(() => readLiveSupabaseQaEnv({ QA_LIVE_SUPABASE: '1' })).toThrow('VITE_SUPABASE_URL');

    expect(readLiveSupabaseQaEnv({
      QA_LIVE_SUPABASE: '1',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key',
      QA_SUPABASE_USER_A_EMAIL: 'a@example.com',
      QA_SUPABASE_USER_A_PASSWORD: 'password-a',
      QA_SUPABASE_USER_B_EMAIL: 'b@example.com',
      QA_SUPABASE_USER_B_PASSWORD: 'password-b',
    })).toMatchObject({
      enabled: true,
      url: 'https://example.supabase.co',
      publishableKey: 'anon-key',
      serviceRoleKey: '',
      userA: { email: 'a@example.com', password: 'password-a' },
      userB: { email: 'b@example.com', password: 'password-b' },
    });
  });

  it('can use a Supabase secret to provision disposable QA users when explicit users are omitted', () => {
    expect(readLiveSupabaseQaEnv({
      QA_LIVE_SUPABASE: '1',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key',
      SUPABASE_SECRET: 'service-key',
    })).toMatchObject({
      enabled: true,
      url: 'https://example.supabase.co',
      publishableKey: 'anon-key',
      serviceRoleKey: 'service-key',
      userA: null,
      userB: null,
    });
  });

  it('builds a row payload that persists canvas_state and line_count together', () => {
    const payload = buildLiveQaDiagramPayload({
      userId: 'user-a',
      title: 'QA canvas persistence',
      source: 'diagram Qa : class {\n  class A {}\n}',
      canvasState: '{"version":1,"elements":[]}',
      activeDiagramName: 'Qa',
    });

    expect(payload).toEqual({
      user_id: 'user-a',
      title: 'QA canvas persistence',
      source: 'diagram Qa : class {\n  class A {}\n}',
      canvas_state: '{"version":1,"elements":[]}',
      active_diagram_name: 'Qa',
      line_count: 3,
    });
  });

  it('treats empty RLS reads and updates as successful isolation proof', () => {
    expect(() => requireInvisibleRows('diagrams', [])).not.toThrow();
    expect(() => requireInvisibleRows('diagrams', null)).not.toThrow();
    expect(() => requireInvisibleRows('diagrams', [{ id: 'leaked' }])).toThrow('RLS isolation failed for diagrams');
  });

  it('recognizes check constraint and trigger failures from Supabase responses', () => {
    expect(isDatabaseLimitError({ code: '23514', message: 'check failed' })).toBe(true);
    expect(isDatabaseLimitError({ message: 'The demo limit is 20 saved files per user.' })).toBe(true);
    expect(isDatabaseLimitError(null)).toBe(false);
  });
});
