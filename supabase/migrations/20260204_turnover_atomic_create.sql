-- Atomic turnover creation: prevents race conditions on turnover_number
-- Uses advisory lock + INSERT ... RETURNING to guarantee unique numbers

CREATE OR REPLACE FUNCTION create_turnover_atomic(
  p_project_id UUID,
  p_sequence_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_general_notes TEXT DEFAULT NULL,
  p_source_edl_filename TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'draft'
)
RETURNS TABLE(
  id UUID,
  turnover_number INTEGER,
  project_id UUID,
  sequence_id UUID,
  title TEXT
) AS $$
DECLARE
  v_next_number INTEGER;
  v_id UUID;
  v_title TEXT;
BEGIN
  -- Advisory lock on project_id to serialize turnover creation per project
  PERFORM pg_advisory_xact_lock(hashtext(p_project_id::text));

  -- Get next turnover number atomically
  SELECT COALESCE(MAX(t.turnover_number), 0) + 1
  INTO v_next_number
  FROM turnovers t
  WHERE t.project_id = p_project_id;

  -- Use provided title or generate default
  v_title := COALESCE(p_title, 'Turnover ' || v_next_number);

  -- Insert with the computed number
  INSERT INTO turnovers (
    project_id, sequence_id, turnover_number, title,
    general_notes, source_edl_filename, status
  )
  VALUES (
    p_project_id, p_sequence_id, v_next_number, v_title,
    p_general_notes, p_source_edl_filename, p_status
  )
  RETURNING turnovers.id INTO v_id;

  RETURN QUERY
  SELECT v_id, v_next_number, p_project_id, p_sequence_id, v_title;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_turnover_atomic IS 
  'Atomically creates a turnover with the next sequential number for a project. Uses advisory lock to prevent race conditions.';
