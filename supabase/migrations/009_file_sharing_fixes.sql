-- Migration 009: File Sharing and Access Control Fixes

-- 1. Helper function to check if the current user has access to a specific diagram
CREATE OR REPLACE FUNCTION public.has_diagram_access(d_id uuid)
RETURNS boolean AS $$
DECLARE
  v_project_id uuid;
BEGIN
  -- Get the project ID for the diagram
  SELECT project_id INTO v_project_id FROM public.diagrams WHERE id = d_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If owner of the project, access granted.
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id AND owner_id = auth.uid()) THEN
    RETURN true;
  END IF;

  -- If has project-level access (diagram_id is NULL), access granted.
  IF EXISTS (SELECT 1 FROM public.project_access WHERE project_id = v_project_id AND user_id = auth.uid() AND diagram_id IS NULL) THEN
    RETURN true;
  END IF;

  -- If has specific diagram-level access, access granted.
  IF EXISTS (SELECT 1 FROM public.project_access WHERE project_id = v_project_id AND user_id = auth.uid() AND diagram_id = d_id) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update public.diagrams RLS policies to use diagram-level access checks
DROP POLICY IF EXISTS "Users can view accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can view accessed diagrams"
  ON public.diagrams FOR SELECT
  USING ( public.has_diagram_access(id) );

DROP POLICY IF EXISTS "Users can update accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can update accessed diagrams"
  ON public.diagrams FOR UPDATE
  USING ( public.has_diagram_access(id) );

DROP POLICY IF EXISTS "Users can delete accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can delete accessed diagrams"
  ON public.diagrams FOR DELETE
  USING ( public.has_diagram_access(id) );

DROP POLICY IF EXISTS "Users can insert accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can insert accessed diagrams"
  ON public.diagrams FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_access WHERE project_id = project_id AND user_id = auth.uid() AND diagram_id IS NULL)
  );

-- 3. Update public.redeem_share_link to support diagram-level sharing
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

  -- Add or update project_access
  IF NOT EXISTS (
    SELECT 1 FROM public.project_access 
    WHERE project_id = v_link.project_id 
      AND user_id = auth.uid() 
      AND (diagram_id IS NULL OR diagram_id = v_link.diagram_id)
  ) THEN
    INSERT INTO public.project_access (project_id, user_id, role, diagram_id, granted_by)
    VALUES (v_link.project_id, auth.uid(), v_link.role, v_link.diagram_id, v_link.created_by);
  ELSE
    UPDATE public.project_access 
    SET role = v_link.role 
    WHERE project_id = v_link.project_id 
      AND user_id = auth.uid() 
      AND (diagram_id IS NULL OR diagram_id = v_link.diagram_id);
  END IF;

  -- Increment use count
  UPDATE public.share_links SET use_count = use_count + 1 WHERE id = v_link.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update public.get_shared_project_data to return only the shared file if diagram_id is set
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
  
  -- Fetch diagrams (filter by diagram_id if set)
  IF v_link.diagram_id IS NOT NULL THEN
    SELECT json_agg(row_to_json(d)) INTO v_diagrams 
    FROM public.diagrams d 
    WHERE id = v_link.diagram_id;
  ELSE
    SELECT json_agg(row_to_json(d)) INTO v_diagrams 
    FROM public.diagrams d 
    WHERE project_id = v_link.project_id;
  END IF;

  RETURN json_build_object(
    'project', v_project,
    'diagrams', COALESCE(v_diagrams, '[]'::json),
    'role', v_link.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
