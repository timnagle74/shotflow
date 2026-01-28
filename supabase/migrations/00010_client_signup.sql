-- Migration: Update user creation trigger to support client signups
-- Checks for signup_source metadata to determine role assignment

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate function with client signup support
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  signup_source text;
  assigned_role user_role;
BEGIN
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
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates public.users record on signup. Assigns CLIENT role for client portal signups, ARTIST for team signups.';
