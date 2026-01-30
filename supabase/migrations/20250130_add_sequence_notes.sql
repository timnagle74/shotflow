-- Add notes column to sequences table for general VFX notes from turnovers
ALTER TABLE sequences
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN sequences.notes IS 'General VFX notes that apply to all shots in this sequence (from turnover import)';
