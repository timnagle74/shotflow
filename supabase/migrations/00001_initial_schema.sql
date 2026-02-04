-- ShotFlow VFX Pipeline — Initial Schema

-- Enums
CREATE TYPE user_role AS ENUM ('ADMIN', 'SUPERVISOR', 'ARTIST', 'CLIENT');
CREATE TYPE project_status AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');
CREATE TYPE shot_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'APPROVED', 'FINAL');
CREATE TYPE shot_complexity AS ENUM ('SIMPLE', 'MEDIUM', 'COMPLEX', 'HERO');
CREATE TYPE version_status AS ENUM ('WIP', 'PENDING_REVIEW', 'APPROVED', 'REVISE', 'CBB');
CREATE TYPE delivery_status AS ENUM ('PENDING', 'DELIVERED', 'ACCEPTED');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'ARTIST',
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  status project_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sequences
CREATE TABLE sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE(project_id, code)
);

-- Shots
CREATE TABLE shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  status shot_status NOT NULL DEFAULT 'NOT_STARTED',
  complexity shot_complexity NOT NULL DEFAULT 'MEDIUM',
  assigned_to_id UUID REFERENCES users(id),
  due_date DATE,
  frame_start INT,
  frame_end INT,
  handle_head INT DEFAULT 8,
  handle_tail INT DEFAULT 8,
  plate_source TEXT,
  camera_data JSONB,
  edit_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, code)
);

-- Versions
CREATE TABLE versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  created_by_id UUID NOT NULL REFERENCES users(id),
  status version_status NOT NULL DEFAULT 'WIP',
  file_path TEXT,
  thumbnail_path TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shot_id, version_number)
);

-- Notes
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  frame_reference INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deliveries
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES versions(id),
  delivered_at TIMESTAMPTZ,
  specs JSONB,
  status delivery_status NOT NULL DEFAULT 'PENDING'
);

-- Turnovers (full definition in 20260131_turnovers.sql migration)
-- Using CREATE TABLE IF NOT EXISTS to avoid conflicts with dedicated migration
CREATE TABLE IF NOT EXISTS turnovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_file TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by_id UUID REFERENCES users(id),
  shot_count INT NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_shots_sequence ON shots(sequence_id);
CREATE INDEX idx_shots_status ON shots(status);
CREATE INDEX idx_shots_assigned ON shots(assigned_to_id);
CREATE INDEX idx_versions_shot ON versions(shot_id);
CREATE INDEX idx_notes_version ON notes(version_id);
CREATE INDEX idx_sequences_project ON sequences(project_id);
CREATE INDEX idx_deliveries_shot ON deliveries(shot_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER shots_updated_at BEFORE UPDATE ON shots FOR EACH ROW EXECUTE FUNCTION update_updated_at();
