-- Source Media table: Master database of all clips from dailies/ALEs
-- Shots link to source_media to inherit metadata

CREATE TABLE IF NOT EXISTS source_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Clip identification
  clip_name TEXT NOT NULL,
  tape TEXT,
  uuid TEXT,
  
  -- Timecode
  tc_in TEXT,
  tc_out TEXT,
  tc_in_frames INTEGER,
  tc_out_frames INTEGER,
  fps DECIMAL(5,2) DEFAULT 24,
  duration_frames INTEGER,
  
  -- File info
  file_path TEXT,
  file_type TEXT,
  resolution TEXT,
  codec TEXT,
  
  -- Camera metadata
  camera TEXT,
  camera_id TEXT,
  camera_roll TEXT,
  lens TEXT,
  focal_length TEXT,
  focus_distance TEXT,
  f_stop TEXT,
  t_stop TEXT,
  iso TEXT,
  shutter TEXT,
  sensor_fps TEXT,
  white_balance TEXT,
  
  -- Scene/shot info
  scene TEXT,
  take TEXT,
  circled BOOLEAN DEFAULT FALSE,
  day_night TEXT,
  int_ext TEXT,
  location TEXT,
  
  -- People
  director TEXT,
  dop TEXT,
  
  -- Sound
  sound_roll TEXT,
  sound_tc TEXT,
  
  -- Color
  colorspace TEXT,
  look TEXT,
  lut TEXT,
  
  -- CDL data
  cdl_slope_r DECIMAL(10,6),
  cdl_slope_g DECIMAL(10,6),
  cdl_slope_b DECIMAL(10,6),
  cdl_offset_r DECIMAL(10,6),
  cdl_offset_g DECIMAL(10,6),
  cdl_offset_b DECIMAL(10,6),
  cdl_power_r DECIMAL(10,6),
  cdl_power_g DECIMAL(10,6),
  cdl_power_b DECIMAL(10,6),
  cdl_saturation DECIMAL(10,6),
  
  -- Shoot info
  shoot_date TEXT,
  shoot_day TEXT,
  
  -- Import tracking
  ale_source TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Extra fields
  custom_metadata JSONB,
  
  -- Indexes
  UNIQUE(project_id, clip_name, tc_in_frames)
);

CREATE INDEX idx_source_media_project ON source_media(project_id);
CREATE INDEX idx_source_media_clip_name ON source_media(clip_name);
CREATE INDEX idx_source_media_scene ON source_media(scene);
CREATE INDEX idx_source_media_tc ON source_media(tc_in_frames, tc_out_frames);

-- Add editorial data columns to shots table
ALTER TABLE shots ADD COLUMN IF NOT EXISTS source_media_id UUID REFERENCES source_media(id);
ALTER TABLE shots ADD COLUMN IF NOT EXISTS source_clip_name TEXT;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS source_tc_in TEXT;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS source_tc_out TEXT;

-- Reposition data
ALTER TABLE shots ADD COLUMN IF NOT EXISTS has_reposition BOOLEAN DEFAULT FALSE;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS repo_scale DECIMAL(6,2);
ALTER TABLE shots ADD COLUMN IF NOT EXISTS repo_scale_x DECIMAL(6,2);
ALTER TABLE shots ADD COLUMN IF NOT EXISTS repo_scale_y DECIMAL(6,2);
ALTER TABLE shots ADD COLUMN IF NOT EXISTS repo_position_x DECIMAL(8,2);
ALTER TABLE shots ADD COLUMN IF NOT EXISTS repo_position_y DECIMAL(8,2);
ALTER TABLE shots ADD COLUMN IF NOT EXISTS repo_rotation DECIMAL(6,2);

-- Speed data
ALTER TABLE shots ADD COLUMN IF NOT EXISTS has_speed_change BOOLEAN DEFAULT FALSE;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS speed_ratio DECIMAL(6,4);
ALTER TABLE shots ADD COLUMN IF NOT EXISTS speed_reverse BOOLEAN DEFAULT FALSE;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS speed_time_remap BOOLEAN DEFAULT FALSE;

-- Record timeline position
ALTER TABLE shots ADD COLUMN IF NOT EXISTS record_tc_in TEXT;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS record_tc_out TEXT;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS record_frame_in INTEGER;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS record_frame_out INTEGER;

-- Index for source media lookups
CREATE INDEX IF NOT EXISTS idx_shots_source_media ON shots(source_media_id);

COMMENT ON TABLE source_media IS 'Master database of all source clips imported from ALEs. Shots link here to inherit camera/lens metadata.';
COMMENT ON COLUMN shots.has_reposition IS 'True if editorial applied scale/position/rotation to this shot';
COMMENT ON COLUMN shots.has_speed_change IS 'True if editorial applied speed/retime to this shot';
