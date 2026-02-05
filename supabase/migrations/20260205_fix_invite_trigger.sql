-- Fix handle_new_user trigger to skip invited users
-- Invited users have 'invited' or 'invite' in their confirmation path
-- The invite API route handles creating their public.users record

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  signup_source text;
  assigned_role user_role;
BEGIN
  -- Skip invited users - they're handled by the invite API route
  -- Invited users have a recovery token set (confirmation flow)
  IF new.invited_at IS NOT NULL THEN
    RETURN new;
  END IF;

  -- Check if signup came from client portal
  signup_source := new.raw_user_meta_data->>'signup_source';
  
  -- Assign role based on signup source
  IF signup_source = 'client' THEN
    assigned_role := 'CLIENT';
  ELSE
    assigned_role := 'ARTIST';
  END IF;

  INSERT INTO public.users (auth_id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    assigned_role
  )
  ON CONFLICT (email) DO UPDATE SET
    auth_id = EXCLUDED.auth_id,
    name = COALESCE(EXCLUDED.name, public.users.name),
    role = COALESCE(public.users.role, EXCLUDED.role);

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Don't block auth signup if public.users insert fails
  RAISE WARNING 'handle_new_user failed for %: %', new.email, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 
  'Auto-creates public.users on signup. Skips invited users (handled by invite API).';
