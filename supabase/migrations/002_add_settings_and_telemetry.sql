-- Add settings column to profiles table if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Create telemetry_events table
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert telemetry
CREATE POLICY "Anyone can insert telemetry."
  ON public.telemetry_events FOR INSERT
  WITH CHECK ( true );

-- Only admins/system can read telemetry
CREATE POLICY "Only system can read telemetry."
  ON public.telemetry_events FOR SELECT
  USING ( false ); -- Set to false for now, assuming only superuser reads it
