-- Migration: Link Supabase Auth users to the public.users table
-- This creates a trigger to auto-create a user record when someone signs up

-- Add auth_id column to users table to link with auth.users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- Create index for faster lookups by auth_id
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- Function to handle new user signup
-- This creates a record in public.users when a new auth.users record is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'ARTIST'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create user record on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Comment explaining the setup
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a public.users record when a new user signs up via Supabase Auth';
