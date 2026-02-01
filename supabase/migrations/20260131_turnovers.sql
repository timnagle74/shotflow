-- Turnovers: A batch of shots sent from editorial to VFX
CREATE TABLE turnovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES sequences(id) ON DELETE SET NULL,
  turnover_number INTEGER NOT NULL DEFAULT 1,
  turnover_date DATE DEFAULT CURRENT_DATE,
  title VARCHAR(255),
  general_notes TEXT,
  
  -- Shared reference clip (the scene in context)
  ref_filename VARCHAR(255),
  ref_storage_path VARCHAR(500),
  ref_cdn_url VARCHAR(500),
  ref_video_id VARCHAR(100),
  ref_preview_url VARCHAR(500),
  
  -- Source file info
  source_edl_filename VARCHAR(255),
  source_ale_filename VARCHAR(255),
  source_xml_filename VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID REFERENCES users(id),
  
  -- Unique TO# per project
  UNIQUE(project_id, turnover_number)
);

-- Junction table: shots in a turnover (many-to-many)
CREATE TABLE turnover_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turnover_id UUID NOT NULL REFERENCES turnovers(id) ON DELETE CASCADE,
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  
  -- Per-shot turnover-specific data
  vfx_notes TEXT,
  source_in VARCHAR(20),
  source_out VARCHAR(20),
  record_in VARCHAR(20),
  record_out VARCHAR(20),
  duration_frames INTEGER,
  clip_name VARCHAR(255),
  reel_name VARCHAR(100),
  
  -- Ordering within turnover
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(turnover_id, shot_id)
);

-- Indexes
CREATE INDEX idx_turnovers_project ON turnovers(project_id);
CREATE INDEX idx_turnovers_sequence ON turnovers(sequence_id);
CREATE INDEX idx_turnover_shots_turnover ON turnover_shots(turnover_id);
CREATE INDEX idx_turnover_shots_shot ON turnover_shots(shot_id);

-- Auto-increment turnover_number per project
CREATE OR REPLACE FUNCTION get_next_turnover_number(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(turnover_number), 0) + 1
  INTO next_num
  FROM turnovers
  WHERE project_id = p_project_id;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_turnover_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER turnovers_updated_at
  BEFORE UPDATE ON turnovers
  FOR EACH ROW
  EXECUTE FUNCTION update_turnover_timestamp();

-- RLS Policies (basic - enable for authenticated users)
ALTER TABLE turnovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnover_shots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON turnovers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON turnover_shots
  FOR ALL USING (true) WITH CHECK (true);
