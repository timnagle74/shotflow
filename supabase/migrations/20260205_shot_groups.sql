-- Shot Groups: Group related shots that share common elements (plates, refs, comp approach)

-- Groups table
CREATE TABLE IF NOT EXISTS shot_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1', -- For visual identification
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Group membership (shots can belong to multiple groups)
CREATE TABLE IF NOT EXISTS shot_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_group_id UUID NOT NULL REFERENCES shot_groups(id) ON DELETE CASCADE,
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shot_group_id, shot_id)
);

-- Shared plates attached to a group (linked to all member shots)
CREATE TABLE IF NOT EXISTS shot_group_plates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_group_id UUID NOT NULL REFERENCES shot_groups(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  description TEXT,
  storage_path TEXT,
  cdn_url TEXT,
  preview_url TEXT,
  video_id TEXT,
  file_size BIGINT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shared refs attached to a group
CREATE TABLE IF NOT EXISTS shot_group_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_group_id UUID NOT NULL REFERENCES shot_groups(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  description TEXT,
  storage_path TEXT,
  cdn_url TEXT,
  preview_url TEXT,
  video_id TEXT,
  file_size BIGINT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shot_groups_project ON shot_groups(project_id);
CREATE INDEX IF NOT EXISTS idx_shot_groups_sequence ON shot_groups(sequence_id);
CREATE INDEX IF NOT EXISTS idx_shot_group_members_group ON shot_group_members(shot_group_id);
CREATE INDEX IF NOT EXISTS idx_shot_group_members_shot ON shot_group_members(shot_id);
CREATE INDEX IF NOT EXISTS idx_shot_group_plates_group ON shot_group_plates(shot_group_id);
CREATE INDEX IF NOT EXISTS idx_shot_group_refs_group ON shot_group_refs(shot_group_id);

-- RLS policies
ALTER TABLE shot_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_group_plates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_group_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read shot_groups" ON shot_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert shot_groups" ON shot_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update shot_groups" ON shot_groups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete shot_groups" ON shot_groups FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read shot_group_members" ON shot_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert shot_group_members" ON shot_group_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated delete shot_group_members" ON shot_group_members FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read shot_group_plates" ON shot_group_plates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert shot_group_plates" ON shot_group_plates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update shot_group_plates" ON shot_group_plates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete shot_group_plates" ON shot_group_plates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read shot_group_refs" ON shot_group_refs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert shot_group_refs" ON shot_group_refs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update shot_group_refs" ON shot_group_refs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete shot_group_refs" ON shot_group_refs FOR DELETE TO authenticated USING (true);

COMMENT ON TABLE shot_groups IS 'Groups of related shots sharing common elements (plates, refs, comp approach)';
COMMENT ON TABLE shot_group_members IS 'Many-to-many: shots can belong to multiple groups';
COMMENT ON TABLE shot_group_plates IS 'Shared plates attached to a group, available to all member shots';
COMMENT ON TABLE shot_group_refs IS 'Shared refs attached to a group, available to all member shots';
