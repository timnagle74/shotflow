-- Fix shot_ref_id for frame_annotations
-- The column was added ad-hoc without a migration; this fixes the schema

-- First, drop the existing check constraint that doesn't include shot_ref_id
ALTER TABLE frame_annotations DROP CONSTRAINT IF EXISTS chk_annotation_source;

-- Drop any incorrect FK on shot_ref_id (might reference versions instead of shots)
ALTER TABLE frame_annotations DROP CONSTRAINT IF EXISTS frame_annotations_shot_ref_id_fkey;

-- Ensure shot_ref_id column exists with correct FK to shots table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'frame_annotations' AND column_name = 'shot_ref_id'
  ) THEN
    ALTER TABLE frame_annotations ADD COLUMN shot_ref_id UUID;
  END IF;
END $$;

-- Add proper FK constraint to shots table
ALTER TABLE frame_annotations 
  ADD CONSTRAINT frame_annotations_shot_ref_id_fkey 
  FOREIGN KEY (shot_ref_id) REFERENCES shots(id) ON DELETE CASCADE;

-- Add index for shot_ref_id lookups
CREATE INDEX IF NOT EXISTS idx_frame_annotations_shot_ref 
  ON frame_annotations(shot_ref_id) WHERE shot_ref_id IS NOT NULL;

-- Add new check constraint that includes shot_ref_id
-- Exactly one of version_id, ref_id, plate_id, or shot_ref_id must be set
ALTER TABLE frame_annotations ADD CONSTRAINT chk_annotation_source 
  CHECK (
    (version_id IS NOT NULL AND ref_id IS NULL AND plate_id IS NULL AND shot_ref_id IS NULL) OR
    (version_id IS NULL AND ref_id IS NOT NULL AND plate_id IS NULL AND shot_ref_id IS NULL) OR
    (version_id IS NULL AND ref_id IS NULL AND plate_id IS NOT NULL AND shot_ref_id IS NULL) OR
    (version_id IS NULL AND ref_id IS NULL AND plate_id IS NULL AND shot_ref_id IS NOT NULL)
  );
