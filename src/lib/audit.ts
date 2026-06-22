import { supabase } from './supabase.js';

type AuditAction =
  | 'login'
  | 'logout'
  | 'project_created'
  | 'project_deleted'
  | 'access_granted'
  | 'access_revoked'
  | 'diagram_saved'
  | 'share_link_created'
  | 'share_link_revoked'
  | 'account_deleted'
  | 'settings_changed'
  | 'share_link_redeemed';

/**
 * Logs an audit event to the audit_log table.
 * Silently fails — audit should never break the application flow.
 */
export async function logAudit(
  action: AuditAction,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
      user_agent: navigator.userAgent,
    });
  } catch {
    // Silent fail — audit should never break the app
  }
}
