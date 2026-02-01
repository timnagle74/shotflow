-- Vendors and Artists for shot assignment

-- Vendors table (linked to facility/project)
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50), -- Short code like "FRAMESTORE", "ILM"
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, code)
);

-- Artists table (belong to vendors)
CREATE TABLE artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(100), -- Lead, Senior, Junior, etc.
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(vendor_id, email)
);

-- Add assignment fields to turnover_shots
ALTER TABLE turnover_shots
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES artists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by_id UUID REFERENCES users(id);

-- Add more turnover statuses
-- draft → reviewed → pending_assignment → assigned → in_progress → complete
ALTER TABLE turnovers
  DROP CONSTRAINT IF EXISTS turnovers_status_check;

-- Update status to allow new values (no constraint, just text)
-- Status flow: draft → reviewed → assigned → in_progress → delivered

-- Indexes
CREATE INDEX idx_vendors_project ON vendors(project_id);
CREATE INDEX idx_vendors_active ON vendors(project_id, active);
CREATE INDEX idx_artists_vendor ON artists(vendor_id);
CREATE INDEX idx_turnover_shots_vendor ON turnover_shots(vendor_id);
CREATE INDEX idx_turnover_shots_artist ON turnover_shots(artist_id);

-- RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON vendors
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON artists
  FOR ALL USING (true) WITH CHECK (true);

-- Update timestamp trigger for vendors
CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
