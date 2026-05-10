import { createClient, type User } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type SupabaseAuthStatus = 'unconfigured' | 'signed_out' | 'signed_in';

export interface SupabaseAuthState {
  status: SupabaseAuthStatus;
  user: Pick<User, 'id'> | User | null;
}

export function resolveAuthState(user: Pick<User, 'id'> | User | null | undefined, configured = isSupabaseConfigured): SupabaseAuthState {
  if (!configured) return { status: 'unconfigured', user: null };
  return user ? { status: 'signed_in', user } : { status: 'signed_out', user: null };
}

export async function getCurrentAuthState(): Promise<SupabaseAuthState> {
  if (!supabase) return resolveAuthState(null, false);
  const { data, error } = await supabase.auth.getUser();
  if (error) return resolveAuthState(null, true);
  return resolveAuthState(data.user, true);
}

export function subscribeToAuthState(onChange: (state: SupabaseAuthState) => void): () => void {
  if (!supabase) {
    onChange(resolveAuthState(null, false));
    return () => undefined;
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(resolveAuthState(session?.user ?? null, true));
  });

  return () => subscription.unsubscribe();
}
