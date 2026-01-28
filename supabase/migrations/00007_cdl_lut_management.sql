-- CDL values per shot (ASC CDL standard)
CREATE TABLE shot_cdls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  slope_r DECIMAL(10,6) DEFAULT 1.0,
  slope_g DECIMAL(10,6) DEFAULT 1.0,
  slope_b DECIMAL(10,6) DEFAULT 1.0,
  offset_r DECIMAL(10,6) DEFAULT 0.0,
  offset_g DECIMAL(10,6) DEFAULT 0.0,
  offset_b DECIMAL(10,6) DEFAULT 0.0,
  power_r DECIMAL(10,6) DEFAULT 1.0,
  power_g DECIMAL(10,6) DEFAULT 1.0,
  power_b DECIMAL(10,6) DEFAULT 1.0,
  saturation DECIMAL(10,6) DEFAULT 1.0,
  source TEXT,
  source_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shot_id)
);

-- LUT files per project or per shot
CREATE TABLE lut_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  shot_id UUID REFERENCES shots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lut_type TEXT NOT NULL,
  format TEXT,
  file_path TEXT,
  file_size INT,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  uploaded_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shot_cdls_shot ON shot_cdls(shot_id);
CREATE INDEX idx_lut_files_project ON lut_files(project_id);
CREATE INDEX idx_lut_files_shot ON lut_files(shot_id);

CREATE TRIGGER shot_cdls_updated_at BEFORE UPDATE ON shot_cdls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed CDL data for existing shots
INSERT INTO shot_cdls (shot_id, slope_r, slope_g, slope_b, offset_r, offset_g, offset_b, power_r, power_g, power_b, saturation, source)
SELECT id, 1.0200, 0.9800, 1.0100, 0.0050, -0.0030, 0.0010, 1.0000, 1.0000, 1.0000, 1.0500, 'ALE'
FROM shots LIMIT 1;

INSERT INTO shot_cdls (shot_id, slope_r, slope_g, slope_b, offset_r, offset_g, offset_b, power_r, power_g, power_b, saturation, source)
SELECT id, 0.9900, 1.0100, 1.0300, -0.0020, 0.0040, -0.0010, 1.0100, 0.9900, 1.0000, 0.9800, 'manual'
FROM shots OFFSET 1 LIMIT 1;

INSERT INTO shot_cdls (shot_id, slope_r, slope_g, slope_b, offset_r, offset_g, offset_b, power_r, power_g, power_b, saturation, source, source_file)
SELECT id, 1.0500, 1.0000, 0.9700, 0.0100, 0.0000, -0.0050, 1.0200, 1.0000, 0.9800, 1.0200, 'CDL file', 'grade_v02.cdl'
FROM shots OFFSET 2 LIMIT 1;
