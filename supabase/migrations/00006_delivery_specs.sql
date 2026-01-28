-- Per-project delivery specifications

CREATE TABLE delivery_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  resolution TEXT,
  format TEXT,
  frame_rate TEXT,
  color_space TEXT,
  bit_depth TEXT,
  handles_head INT DEFAULT 8,
  handles_tail INT DEFAULT 8,
  naming_convention TEXT,
  audio_requirements TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER delivery_specs_updated_at
  BEFORE UPDATE ON delivery_specs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed delivery specs for existing projects
INSERT INTO delivery_specs (project_id, resolution, format, frame_rate, color_space, bit_depth, handles_head, handles_tail, naming_convention, audio_requirements, additional_notes) VALUES
  ('b0000000-0000-0000-0000-000000000001', '2048x1080 (2K)', 'OpenEXR', '23.976', 'ACES AP0 (Linear)', '16-bit Half Float', 8, 8, '{PROJECT}_{SEQ}_{SHOT}_v{VER}.{FRAME}.exr', 'N/A — VFX only', 'All comps must include utility passes (depth, motion vectors, crypto)'),
  ('b0000000-0000-0000-0000-000000000002', '3840x2160 (4K UHD)', 'OpenEXR', '24', 'ACEScg', '16-bit Half Float', 12, 12, '{PROJECT}_{SEQ}_{SHOT}_v{VER}.{FRAME}.exr', 'Sync reference WAV required', 'HDR deliverables may be requested for select hero shots'),
  ('b0000000-0000-0000-0000-000000000003', '1920x1080 (HD)', 'DPX', '23.976', 'Rec.709', '10-bit Log', 8, 8, '{SHOW}_{SEQ}_{SHOT}_v{VER}.{FRAME}.dpx', 'N/A', NULL);
