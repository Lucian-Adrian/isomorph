-- Add yjs_state bytea column to diagrams for binary Yjs document snapshots
ALTER TABLE public.diagrams ADD COLUMN IF NOT EXISTS yjs_state bytea;

-- Add anonymous_sessions table
CREATE TABLE IF NOT EXISTS public.anonymous_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  session_token varchar(128) UNIQUE NOT NULL,
  display_name varchar(50) NOT NULL,
  role text NOT NULL,
  cursor_colour text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  last_seen_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  expires_at timestamp with time zone NOT NULL
);

ALTER TABLE public.anonymous_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anonymous sessions are viewable by everyone in the project"
  ON public.anonymous_sessions FOR SELECT
  USING (true);
CREATE POLICY "Users can insert their anonymous session"
  ON public.anonymous_sessions FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Users can update their anonymous session"
  ON public.anonymous_sessions FOR UPDATE
  USING (true);

-- Add comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  anon_session_id uuid REFERENCES public.anonymous_sessions(id) ON DELETE SET NULL,
  diagram_name text,
  entity_name text,
  x_position double precision,
  y_position double precision,
  body text NOT NULL,
  resolved boolean DEFAULT false,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are viewable by everyone in project"
  ON public.comments FOR SELECT
  USING (true);
CREATE POLICY "Anyone can insert comments"
  ON public.comments FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Comment author can update"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Comment author or owner can delete"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id OR EXISTS(SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));

-- Add project_access table
CREATE TABLE IF NOT EXISTS public.project_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project access is viewable by project members"
  ON public.project_access FOR SELECT
  USING (true);
CREATE POLICY "Project owner can insert access"
  ON public.project_access FOR INSERT
  WITH CHECK (EXISTS(SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));
CREATE POLICY "Project owner can update access"
  ON public.project_access FOR UPDATE
  USING (EXISTS(SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));
CREATE POLICY "Project owner can delete access"
  ON public.project_access FOR DELETE
  USING (EXISTS(SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));

-- Add share_links table
CREATE TABLE IF NOT EXISTS public.share_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  token varchar(64) UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  expires_at timestamp with time zone,
  max_uses integer,
  use_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Share links viewable by project owner"
  ON public.share_links FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));
CREATE POLICY "Project owner can insert share links"
  ON public.share_links FOR INSERT
  WITH CHECK (EXISTS(SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));
CREATE POLICY "Project owner can update share links"
  ON public.share_links FOR UPDATE
  USING (EXISTS(SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));
CREATE POLICY "Project owner can delete share links"
  ON public.share_links FOR DELETE
  USING (EXISTS(SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));
