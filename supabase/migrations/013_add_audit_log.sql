-- Migration 013: Add Audit Log Table
-- Provides an append-only audit trail for security-critical actions

CREATE TABLE public.audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'login', 'logout', 'project_created', 'project_deleted', 'access_granted', 'access_revoked', 'diagram_saved', 'share_link_created', 'share_link_revoked', 'account_deleted', 'settings_changed'
  resource_type text, -- 'project', 'diagram', 'share_link', 'profile'
  resource_id uuid,
  metadata jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Insert-only for authenticated users
CREATE POLICY "Users can insert audit entries"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can read their own audit log
CREATE POLICY "Users can read own audit log"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes for fast queries
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
