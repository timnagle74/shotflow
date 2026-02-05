-- Frame Annotations
-- Stores drawing annotations tied to specific video frames

CREATE TABLE IF NOT EXISTS frame_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  frame_number INTEGER NOT NULL,
  timecode TEXT, -- Display timecode (e.g., "01:02:03:15")
  drawing_data JSONB NOT NULL, -- fabric.js canvas JSON
  comment TEXT,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by version + frame
CREATE INDEX idx_frame_annotations_version_frame 
  ON frame_annotations(version_id, frame_number);

-- Index for fetching all annotations for a version
CREATE INDEX idx_frame_annotations_version 
  ON frame_annotations(version_id);

-- RLS policies
ALTER TABLE frame_annotations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view annotations
CREATE POLICY "Users can view annotations" ON frame_annotations
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can create annotations
CREATE POLICY "Users can create annotations" ON frame_annotations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own annotations
CREATE POLICY "Users can update own annotations" ON frame_annotations
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

-- Users can delete their own annotations
CREATE POLICY "Users can delete own annotations" ON frame_annotations
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER set_frame_annotations_updated_at
  BEFORE UPDATE ON frame_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
