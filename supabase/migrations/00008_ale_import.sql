-- ALE Import: shot_metadata table for rich camera/production metadata

CREATE TABLE IF NOT EXISTS shot_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE UNIQUE,
  tape TEXT,
  scene TEXT,
  take TEXT,
  circled BOOLEAN DEFAULT false,
  camera TEXT,
  camera_roll TEXT,
  lens TEXT,
  focal_length TEXT,
  focus_distance TEXT,
  f_stop TEXT,
  t_stop TEXT,
  ei_iso TEXT,
  shutter TEXT,
  sensor_fps TEXT,
  white_balance TEXT,
  colorspace TEXT,
  look_info TEXT,
  codec TEXT,
  src_resolution TEXT,
  src_filetype TEXT,
  filepath TEXT,
  sound_roll TEXT,
  sound_tc TEXT,
  dop TEXT,
  director TEXT,
  gps_position TEXT,
  shoot_date TEXT,
  day_night TEXT,
  int_ext TEXT,
  duration TEXT,
  uuid_ref TEXT,
  lut_nodes TEXT,
  custom_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shot_metadata_shot ON shot_metadata(shot_id);

CREATE TRIGGER shot_metadata_updated_at
  BEFORE UPDATE ON shot_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
