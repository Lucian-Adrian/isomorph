-- Migration 010: Fix Projects and Diagrams RLS policies to prevent insert failure due to subquery visibility during insert returning
DROP POLICY IF EXISTS "Users can view accessed projects" ON public.projects;

CREATE POLICY "Users can view accessed projects"
  ON public.projects FOR SELECT
  USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.project_access 
      WHERE project_access.project_id = projects.id 
        AND project_access.user_id = auth.uid()
    )
  );

-- Fix Diagrams RLS policies to avoid self-referential subqueries during insert/select returning
DROP POLICY IF EXISTS "Users can view accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can view accessed diagrams"
  ON public.diagrams FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_access WHERE project_id = project_id AND user_id = auth.uid() AND (diagram_id IS NULL OR diagram_id = id))
  );

DROP POLICY IF EXISTS "Users can update accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can update accessed diagrams"
  ON public.diagrams FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_access WHERE project_id = project_id AND user_id = auth.uid() AND (diagram_id IS NULL OR diagram_id = id))
  );

DROP POLICY IF EXISTS "Users can delete accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can delete accessed diagrams"
  ON public.diagrams FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_access WHERE project_id = project_id AND user_id = auth.uid() AND (diagram_id IS NULL OR diagram_id = id))
  );
