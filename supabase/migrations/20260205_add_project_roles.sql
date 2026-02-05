-- Add VFX_SUPERVISOR and POST_SUPERVISOR to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'VFX_SUPERVISOR';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'POST_SUPERVISOR';

-- Create project_members table for per-project role assignments
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- A user can only have one role per project
  UNIQUE(project_id, user_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- RLS policies: internal users can view, admins can modify
CREATE POLICY "Internal users can view project members"
  ON project_members FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage project members"
  ON project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_id = auth.uid() 
      AND users.role IN ('ADMIN', 'SUPERVISOR', 'PRODUCER', 'VFX_SUPERVISOR', 'POST_SUPERVISOR')
    )
  );

-- Update trigger for updated_at
CREATE TRIGGER update_project_members_updated_at
  BEFORE UPDATE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
