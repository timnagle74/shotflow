-- Extend frame_annotations to support refs and plates

-- Make version_id nullable
ALTER TABLE frame_annotations ALTER COLUMN version_id DROP NOT NULL;

-- Add ref and plate columns
ALTER TABLE frame_annotations ADD COLUMN ref_id UUID REFERENCES turnover_refs(id) ON DELETE CASCADE;
ALTER TABLE frame_annotations ADD COLUMN plate_id UUID REFERENCES shot_plates(id) ON DELETE CASCADE;

-- Add indexes for ref and plate lookups
CREATE INDEX idx_frame_annotations_ref ON frame_annotations(ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX idx_frame_annotations_plate ON frame_annotations(plate_id) WHERE plate_id IS NOT NULL;

-- Add check constraint: exactly one of version_id, ref_id, or plate_id must be set
ALTER TABLE frame_annotations ADD CONSTRAINT chk_annotation_source 
  CHECK (
    (version_id IS NOT NULL AND ref_id IS NULL AND plate_id IS NULL) OR
    (version_id IS NULL AND ref_id IS NOT NULL AND plate_id IS NULL) OR
    (version_id IS NULL AND ref_id IS NULL AND plate_id IS NOT NULL)
  );
