-- 6. DIAGRAM HISTORY
CREATE TABLE public.diagram_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagram_id uuid REFERENCES public.diagrams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.diagram_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history of diagrams in their projects."
  ON public.diagram_history FOR SELECT
  USING ( EXISTS (
    SELECT 1 FROM public.diagrams d
    JOIN public.projects p ON d.project_id = p.id
    WHERE d.id = diagram_history.diagram_id AND p.owner_id = auth.uid()
  ) );

CREATE POLICY "Users can insert history for diagrams in their projects."
  ON public.diagram_history FOR INSERT
  WITH CHECK ( EXISTS (
    SELECT 1 FROM public.diagrams d
    JOIN public.projects p ON d.project_id = p.id
    WHERE d.id = diagram_history.diagram_id AND p.owner_id = auth.uid()
  ) );

CREATE POLICY "Users can delete history for diagrams in their projects."
  ON public.diagram_history FOR DELETE
  USING ( EXISTS (
    SELECT 1 FROM public.diagrams d
    JOIN public.projects p ON d.project_id = p.id
    WHERE d.id = diagram_history.diagram_id AND p.owner_id = auth.uid()
  ) );
