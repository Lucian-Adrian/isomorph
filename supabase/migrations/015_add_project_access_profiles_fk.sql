-- Add foreign key constraint from project_access(user_id) to profiles(id)
-- to allow PostgREST to perform joins for direct access queries.
ALTER TABLE public.project_access
  DROP CONSTRAINT IF EXISTS project_access_user_id_profiles_fkey;

ALTER TABLE public.project_access
  ADD CONSTRAINT project_access_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
