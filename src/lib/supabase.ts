import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. App will fall back to local mode.');
}

const isDevelopment = import.meta.env.DEV;

// In development, proxy requests to Supabase via our dev server to bypass Enhanced Tracking Protection in Incognito mode
const resolvedSupabaseUrl = (isDevelopment && typeof window !== 'undefined')
  ? `${window.location.origin}/supabase-api`
  : (supabaseUrl || 'http://localhost:54321');

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  resolvedSupabaseUrl,
  supabaseAnonKey || 'placeholder'
);
