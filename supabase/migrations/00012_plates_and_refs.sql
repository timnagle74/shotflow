-- Add plates table and ref columns for VFX turnover workflow
-- AE uploads: ref (required) + plates (multiple, with descriptions)
-- Artist uploads: deliverable + ref (context in sequence)

-- Shot plates table (multiple plates per shot with descriptions)
CREATE TABLE shot_plates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  cdn_url TEXT,
  file_size BIGINT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shot_plates_shot ON shot_plates(shot_id);

-- Add ref columns to shots table (AE's context clip)
ALTER TABLE shots
ADD COLUMN IF NOT EXISTS ref_filename TEXT,
ADD COLUMN IF NOT EXISTS ref_storage_path TEXT,
ADD COLUMN IF NOT EXISTS ref_cdn_url TEXT,
ADD COLUMN IF NOT EXISTS ref_video_id TEXT,
ADD COLUMN IF NOT EXISTS ref_preview_url TEXT;

-- Add ref columns to versions table (artist's context clip)
ALTER TABLE versions
ADD COLUMN IF NOT EXISTS ref_filename TEXT,
ADD COLUMN IF NOT EXISTS ref_storage_path TEXT,
ADD COLUMN IF NOT EXISTS ref_cdn_url TEXT,
ADD COLUMN IF NOT EXISTS ref_video_id TEXT,
ADD COLUMN IF NOT EXISTS ref_preview_url TEXT;

-- Comments
COMMENT ON TABLE shot_plates IS 'Source plates for VFX shots (clean plates, BG elements, etc.)';
COMMENT ON COLUMN shot_plates.description IS 'Plate description (e.g., "Clean plate", "Hero plate", "BG element")';
COMMENT ON COLUMN shot_plates.storage_path IS 'Bunny Storage path for download';
COMMENT ON COLUMN shot_plates.cdn_url IS 'Bunny CDN URL for download';

COMMENT ON COLUMN shots.ref_preview_url IS 'Bunny Stream HLS URL for AE reference clip playback';
COMMENT ON COLUMN shots.ref_video_id IS 'Bunny Stream video ID for AE reference clip';

COMMENT ON COLUMN versions.ref_preview_url IS 'Bunny Stream HLS URL for artist context clip playback';
COMMENT ON COLUMN versions.ref_video_id IS 'Bunny Stream video ID for artist context clip';
