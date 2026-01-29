-- Add Bunny.net video URL columns to versions table
-- preview_url: Bunny Stream HLS URL for web playback
-- download_url: Bunny Storage path for ProRes downloads
-- bunny_video_id: Bunny Stream video GUID for tracking transcoding status

ALTER TABLE versions
ADD COLUMN IF NOT EXISTS preview_url TEXT,
ADD COLUMN IF NOT EXISTS download_url TEXT,
ADD COLUMN IF NOT EXISTS bunny_video_id TEXT;

-- Add index for looking up versions by Bunny video ID
CREATE INDEX IF NOT EXISTS idx_versions_bunny_video_id ON versions(bunny_video_id);

-- Comment explaining the columns
COMMENT ON COLUMN versions.preview_url IS 'Bunny Stream HLS URL for web playback';
COMMENT ON COLUMN versions.download_url IS 'Bunny Storage CDN URL for ProRes downloads';
COMMENT ON COLUMN versions.bunny_video_id IS 'Bunny Stream video GUID for status tracking';
