-- Migration 014: RPC for user lookup by email or username
-- Allows users to grant access to projects by providing an email or username

CREATE OR REPLACE FUNCTION public.get_user_id_by_email_or_username(input_text text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Check if input matches an email in auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = input_text
  LIMIT 1;

  -- If not found, check public.profiles for a username
  IF target_user_id IS NULL THEN
    SELECT id INTO target_user_id
    FROM public.profiles
    WHERE username = input_text
    LIMIT 1;
  END IF;

  RETURN target_user_id;
END;
$$;
