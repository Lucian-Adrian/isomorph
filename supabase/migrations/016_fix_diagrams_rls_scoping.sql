-- Migration 016: Fix scoping in diagrams RLS policies to prevent local shadowing of project_id
DROP POLICY IF EXISTS "Users can view accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can view accessed diagrams"
  ON public.diagrams FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = diagrams.project_id AND projects.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_access WHERE project_access.project_id = diagrams.project_id AND project_access.user_id = auth.uid() AND (project_access.diagram_id IS NULL OR project_access.diagram_id = diagrams.id))
  );

DROP POLICY IF EXISTS "Users can update accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can update accessed diagrams"
  ON public.diagrams FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = diagrams.project_id AND projects.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_access WHERE project_access.project_id = diagrams.project_id AND project_access.user_id = auth.uid() AND (project_access.diagram_id IS NULL OR project_access.diagram_id = diagrams.id))
  );

DROP POLICY IF EXISTS "Users can delete accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can delete accessed diagrams"
  ON public.diagrams FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = diagrams.project_id AND projects.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_access WHERE project_access.project_id = diagrams.project_id AND project_access.user_id = auth.uid() AND (project_access.diagram_id IS NULL OR project_access.diagram_id = diagrams.id))
  );

DROP POLICY IF EXISTS "Users can insert accessed diagrams" ON public.diagrams;
CREATE POLICY "Users can insert accessed diagrams"
  ON public.diagrams FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE projects.id = diagrams.project_id AND projects.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_access WHERE project_access.project_id = diagrams.project_id AND project_access.user_id = auth.uid() AND project_access.diagram_id IS NULL)
  );
