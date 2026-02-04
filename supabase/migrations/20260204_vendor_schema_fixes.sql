-- Fix vendor schema: make project_id nullable (vendors can be global/cross-project)
-- and add user_id to artists table for linking artists to auth users

-- 1. Make project_id nullable on vendors (vendor companies exist independently of projects)
ALTER TABLE vendors ALTER COLUMN project_id DROP NOT NULL;

-- 2. Add user_id to artists table (links artist record to a users row)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_artists_user ON artists(user_id);

-- 3. Drop the unique constraint that requires project_id (since it can be null now)
-- and re-add it to allow null project_id
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_project_id_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS vendors_project_code_unique 
  ON vendors(project_id, code) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vendors_code_global_unique
  ON vendors(code) WHERE project_id IS NULL;
