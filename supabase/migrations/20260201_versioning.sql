-- Version control for turnovers and VFX deliveries

-- Turnover revisions (TO1 r1, TO1 r2, etc.)
-- When editorial sends an updated EDL, we create a new revision
ALTER TABLE turnovers
  ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_turnover_id UUID REFERENCES turnovers(id),
  ADD COLUMN IF NOT EXISTS revision_notes TEXT;

-- VFX Versions/Deliveries (v001, v002, etc.)
CREATE TABLE shot_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  turnover_shot_id UUID REFERENCES turnover_shots(id) ON DELETE SET NULL,
  
  -- Version info
  version_number INTEGER NOT NULL DEFAULT 1,
  version_code VARCHAR(20), -- v001, v002, etc.
  
  -- Status
  status VARCHAR(50) DEFAULT 'wip', -- wip, internal_review, client_review, approved, rejected
  
  -- Files
  filename VARCHAR(255),
  storage_path VARCHAR(500),
  cdn_url VARCHAR(500),
  preview_url VARCHAR(500),
  video_id VARCHAR(100),
  file_size BIGINT,
  
  -- Review
  submitted_at TIMESTAMPTZ,
  submitted_by_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  reviewed_by_id UUID REFERENCES users(id),
  review_notes TEXT,
  
  -- Metadata
  frame_count INTEGER,
  frame_rate DECIMAL(5,2),
  resolution VARCHAR(20), -- 1920x1080, 4096x2160, etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(shot_id, version_number)
);

-- Version status history for audit trail
CREATE TABLE version_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES shot_versions(id) ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_by_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client review sessions
CREATE TABLE review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Session info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Access
  access_token VARCHAR(100) UNIQUE DEFAULT gen_random_uuid()::text,
  password_hash VARCHAR(255), -- Optional password protection
  expires_at TIMESTAMPTZ,
  
  -- Settings
  allow_comments BOOLEAN DEFAULT TRUE,
  allow_approvals BOOLEAN DEFAULT TRUE,
  watermark_text VARCHAR(255),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID REFERENCES users(id)
);

-- Versions included in a review session
CREATE TABLE review_session_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES shot_versions(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  
  -- Per-version review state in this session
  client_status VARCHAR(50), -- pending, approved, rejected, needs_changes
  client_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  
  UNIQUE(session_id, version_id)
);

-- Client comments on versions (timecode-based)
CREATE TABLE version_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES shot_versions(id) ON DELETE CASCADE,
  session_id UUID REFERENCES review_sessions(id) ON DELETE SET NULL,
  
  -- Comment content
  comment_text TEXT NOT NULL,
  timecode_frame INTEGER, -- Frame number for timecode-based comments
  
  -- Author (can be client or internal)
  author_name VARCHAR(255),
  author_email VARCHAR(255),
  author_user_id UUID REFERENCES users(id),
  is_client_comment BOOLEAN DEFAULT FALSE,
  
  -- Threading
  parent_comment_id UUID REFERENCES version_comments(id),
  
  -- Status
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by_id UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update shot status based on latest version
CREATE OR REPLACE FUNCTION update_shot_status_from_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the shot's status based on the latest version
  UPDATE shots
  SET status = CASE 
    WHEN NEW.status = 'approved' THEN 'APPROVED'
    WHEN NEW.status = 'client_review' THEN 'CLIENT_REVIEW'
    WHEN NEW.status = 'internal_review' THEN 'INTERNAL_REVIEW'
    WHEN NEW.status = 'wip' THEN 'IN_PROGRESS'
    ELSE status
  END
  WHERE id = NEW.shot_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER version_status_update
  AFTER UPDATE OF status ON shot_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_shot_status_from_version();

-- Indexes
CREATE INDEX idx_shot_versions_shot ON shot_versions(shot_id);
CREATE INDEX idx_shot_versions_status ON shot_versions(status);
CREATE INDEX idx_shot_versions_turnover_shot ON shot_versions(turnover_shot_id);
CREATE INDEX idx_version_comments_version ON version_comments(version_id);
CREATE INDEX idx_version_comments_session ON version_comments(session_id);
CREATE INDEX idx_review_sessions_project ON review_sessions(project_id);
CREATE INDEX idx_review_sessions_token ON review_sessions(access_token);

-- RLS
ALTER TABLE shot_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_session_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON shot_versions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON version_status_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON review_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON review_session_versions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON version_comments
  FOR ALL USING (true) WITH CHECK (true);
