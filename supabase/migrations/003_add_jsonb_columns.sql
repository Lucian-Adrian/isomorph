-- Add settings column to projects table if it doesn't exist
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add settings column to diagrams table if it doesn't exist
ALTER TABLE public.diagrams ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add settings column to feedback table if it doesn't exist
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
