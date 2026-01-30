-- Add preview URL columns to shot_plates for browser playback
ALTER TABLE shot_plates
ADD COLUMN IF NOT EXISTS video_id TEXT,
ADD COLUMN IF NOT EXISTS preview_url TEXT;

COMMENT ON COLUMN shot_plates.video_id IS 'Bunny Stream video GUID for HLS playback';
COMMENT ON COLUMN shot_plates.preview_url IS 'Bunny Stream HLS URL for web playback';
