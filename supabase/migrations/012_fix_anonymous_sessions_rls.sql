-- Migration 012: Fix Anonymous Sessions RLS
-- Restrict anonymous session visibility to project members only

DROP POLICY IF EXISTS "Anonymous sessions are viewable by everyone in the project" ON public.anonymous_sessions;
DROP POLICY IF EXISTS "Users can insert their anonymous session" ON public.anonymous_sessions;
DROP POLICY IF EXISTS "Users can update their anonymous session" ON public.anonymous_sessions;

-- Only viewable by project members (owner or collaborators)
CREATE POLICY "Anon sessions viewable by project members"
  ON public.anonymous_sessions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_access WHERE project_access.project_id = anonymous_sessions.project_id AND project_access.user_id = auth.uid())
  );

-- Insert is still permissive (anonymous users need to create sessions)
CREATE POLICY "Anyone can create anonymous session"
  ON public.anonymous_sessions FOR INSERT
  WITH CHECK (true);

-- Only the session owner can update (matched by session_token check in app logic)
CREATE POLICY "Session owner can update"
  ON public.anonymous_sessions FOR UPDATE
  USING (true); -- App-level validation via session_token
