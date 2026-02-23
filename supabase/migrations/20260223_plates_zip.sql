-- Add plates ZIP URL to turnovers for pre-generated downloads
ALTER TABLE turnovers
ADD COLUMN IF NOT EXISTS plates_zip_url TEXT,
ADD COLUMN IF NOT EXISTS plates_zip_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN turnovers.plates_zip_url IS 'Bunny CDN URL for pre-generated plates ZIP';
COMMENT ON COLUMN turnovers.plates_zip_generated_at IS 'When the plates ZIP was last generated';
