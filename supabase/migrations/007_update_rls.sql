-- Function to check if the current authenticated user has access to a project
CREATE OR REPLACE FUNCTION public.has_project_access(p_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_access WHERE project_id = p_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update projects policy
DROP POLICY IF EXISTS "Users can view own projects." ON public.projects;
CREATE POLICY "Users can view accessed projects"
  ON public.projects FOR SELECT
  USING ( public.has_project_access(id) );

-- Update diagrams policy
DROP POLICY IF EXISTS "Users can view diagrams of their projects." ON public.diagrams;
CREATE POLICY "Users can view accessed diagrams"
  ON public.diagrams FOR SELECT
  USING ( public.has_project_access(project_id) );

DROP POLICY IF EXISTS "Users can update diagrams of their projects." ON public.diagrams;
CREATE POLICY "Users can update accessed diagrams"
  ON public.diagrams FOR UPDATE
  USING ( public.has_project_access(project_id) );
  
DROP POLICY IF EXISTS "Users can insert diagrams into their projects." ON public.diagrams;
CREATE POLICY "Users can insert accessed diagrams"
  ON public.diagrams FOR INSERT
  WITH CHECK ( public.has_project_access(project_id) );

DROP POLICY IF EXISTS "Users can delete diagrams of their projects." ON public.diagrams;
CREATE POLICY "Users can delete accessed diagrams"
  ON public.diagrams FOR DELETE
  USING ( public.has_project_access(project_id) );

-- RPC to redeem a share link for a logged-in user
CREATE OR REPLACE FUNCTION public.redeem_share_link(p_token text)
RETURNS boolean AS $$
DECLARE
  v_link public.share_links;
BEGIN
  -- Find the link
  SELECT * INTO v_link FROM public.share_links 
  WHERE token = p_token AND is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR use_count < max_uses);
    
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Add to project_access if not exists
  INSERT INTO public.project_access (project_id, user_id, role, granted_by)
  VALUES (v_link.project_id, auth.uid(), v_link.role, v_link.created_by)
  ON CONFLICT (project_id, user_id) 
  DO UPDATE SET role = EXCLUDED.role;

  -- Increment use count
  UPDATE public.share_links SET use_count = use_count + 1 WHERE id = v_link.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to fetch project data for anonymous users via share link
CREATE OR REPLACE FUNCTION public.get_shared_project_data(p_token text)
RETURNS json AS $$
DECLARE
  v_link public.share_links;
  v_project json;
  v_diagrams json;
BEGIN
  -- Validate link
  SELECT * INTO v_link FROM public.share_links 
  WHERE token = p_token AND is_active = true 
    AND (expires_at IS NULL OR expires_at > now());
    
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Fetch project
  SELECT row_to_json(p) INTO v_project FROM public.projects p WHERE id = v_link.project_id;
  
  -- Fetch diagrams
  SELECT json_agg(row_to_json(d)) INTO v_diagrams FROM public.diagrams d WHERE project_id = v_link.project_id;

  RETURN json_build_object(
    'project', v_project,
    'diagrams', COALESCE(v_diagrams, '[]'::json),
    'role', v_link.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
