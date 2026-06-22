import { supabase } from './supabase.js';

let telemetryEnabled = true;
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem) {
    telemetryEnabled = localStorage.getItem('isomorph-telemetry') !== 'false';
  }
} catch (e) {}

export function setTelemetryEnabled(enabled: boolean) {
  telemetryEnabled = enabled;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem('isomorph-telemetry', String(enabled));
    }
  } catch (e) {}
}

export function isTelemetryEnabled() {
  return telemetryEnabled;
}

export async function logEvent(event_name: string, metadata: any = {}) {
  if (!telemetryEnabled) return;

  console.log(`[Telemetry] ${event_name}`, metadata);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // We could insert to a telemetry table, or call an edge function.
    // For now, we'll log it if there's a telemetry table, but silently ignore errors.
    await supabase.from('telemetry_events').insert([{
      user_id: session?.user?.id || null,
      event_type: event_name, // Note: DBML specifies event_type
      event_data: metadata,   // Note: DBML specifies event_data
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    // Silent fail for telemetry
    console.warn(`[Telemetry] Failed to send event to Supabase:`, e);
  }
}
