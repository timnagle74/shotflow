-- Refs rework: One ref can be assigned to many shots
-- Plates: Many plates can belong to one shot (already handled by shot_plates)

-- Turnover refs: refs belong to a turnover, can be assigned to multiple shots
CREATE TABLE turnover_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turnover_id UUID NOT NULL REFERENCES turnovers(id) ON DELETE CASCADE,
  
  -- File info
  filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500),
  cdn_url VARCHAR(500),
  file_size BIGINT,
  
  -- Video streaming
  video_id VARCHAR(100),
  preview_url VARCHAR(500),
  
  -- Auto-match status
  auto_matched BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sort_order INTEGER DEFAULT 0
);

-- Junction: which shots use which ref (many-to-many)
CREATE TABLE turnover_shot_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turnover_shot_id UUID NOT NULL REFERENCES turnover_shots(id) ON DELETE CASCADE,
  turnover_ref_id UUID NOT NULL REFERENCES turnover_refs(id) ON DELETE CASCADE,
  
  -- Was this auto-matched or manually assigned?
  auto_matched BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(turnover_shot_id, turnover_ref_id)
);

-- Update turnover_shots to track plate assignment status
ALTER TABLE turnover_shots 
  ADD COLUMN IF NOT EXISTS plates_assigned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refs_assigned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes_complete BOOLEAN DEFAULT FALSE;

-- Add review status to turnovers
ALTER TABLE turnovers
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by_id UUID REFERENCES users(id);

-- Indexes
CREATE INDEX idx_turnover_refs_turnover ON turnover_refs(turnover_id);
CREATE INDEX idx_turnover_shot_refs_shot ON turnover_shot_refs(turnover_shot_id);
CREATE INDEX idx_turnover_shot_refs_ref ON turnover_shot_refs(turnover_ref_id);
CREATE INDEX idx_turnovers_status ON turnovers(status);

-- RLS
ALTER TABLE turnover_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnover_shot_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON turnover_refs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON turnover_shot_refs
  FOR ALL USING (true) WITH CHECK (true);

-- Note: Existing ref fields on turnovers table kept for backwards compatibility
-- New imports will use turnover_refs table instead
