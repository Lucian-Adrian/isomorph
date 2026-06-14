-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. PROFILES
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  tier text DEFAULT 'basic' CHECK (tier IN ('basic', 'power', 'enterprise')),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );

-- Automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. PROJECTS
CREATE TABLE public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects."
  ON public.projects FOR SELECT
  USING ( auth.uid() = owner_id );

CREATE POLICY "Users can insert own projects."
  ON public.projects FOR INSERT
  WITH CHECK ( auth.uid() = owner_id );

CREATE POLICY "Users can update own projects."
  ON public.projects FOR UPDATE
  USING ( auth.uid() = owner_id );

CREATE POLICY "Users can delete own projects."
  ON public.projects FOR DELETE
  USING ( auth.uid() = owner_id );


-- 3. DIAGRAMS
CREATE TABLE public.diagrams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.diagrams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view diagrams of their projects."
  ON public.diagrams FOR SELECT
  USING ( EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()
  ) );

CREATE POLICY "Users can insert diagrams into their projects."
  ON public.diagrams FOR INSERT
  WITH CHECK ( EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()
  ) );

CREATE POLICY "Users can update diagrams of their projects."
  ON public.diagrams FOR UPDATE
  USING ( EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()
  ) );

CREATE POLICY "Users can delete diagrams of their projects."
  ON public.diagrams FOR DELETE
  USING ( EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()
  ) );


-- 4. FEEDBACK
CREATE TABLE public.feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable for anonymous feedback
  type text NOT NULL CHECK (type IN ('general', 'bug', 'feature')),
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can insert feedback
CREATE POLICY "Anyone can insert feedback."
  ON public.feedback FOR INSERT
  WITH CHECK ( true );

-- Only admins/system can read feedback
CREATE POLICY "Users can read own feedback."
  ON public.feedback FOR SELECT
  USING ( auth.uid() = user_id );


-- 5. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can upload an avatar."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can update their avatar."
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'avatars' );
