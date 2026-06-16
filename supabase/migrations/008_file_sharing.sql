-- Add diagram_id to share_links and project_access for file-level sharing

ALTER TABLE public.share_links ADD COLUMN IF NOT EXISTS diagram_id uuid REFERENCES public.diagrams(id) ON DELETE CASCADE;
ALTER TABLE public.project_access ADD COLUMN IF NOT EXISTS diagram_id uuid REFERENCES public.diagrams(id) ON DELETE CASCADE;

-- Drop old constraint
ALTER TABLE public.project_access DROP CONSTRAINT IF EXISTS project_access_project_id_user_id_key;

-- We rely on application logic to handle uniqueness, or we can add a new constraint. 
-- For safety, we will allow multiple rows if diagram_id differs.
