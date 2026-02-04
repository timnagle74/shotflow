-- RPC function: get_source_media_stats
-- Returns aggregate statistics for source media in a project.
-- Used by the Source Media page to show summary stats without loading all rows.

CREATE OR REPLACE FUNCTION get_source_media_stats(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalClips', COUNT(*)::int,
    'shootDates', COUNT(DISTINCT shoot_date)::int,
    'cameras', COUNT(DISTINCT camera)::int,
    'scenes', COUNT(DISTINCT scene)::int,
    'withCDL', COUNT(*) FILTER (WHERE cdl_slope_r IS NOT NULL)::int
  )
  INTO result
  FROM source_media
  WHERE project_id = p_project_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_source_media_stats IS
  'Returns aggregate stats (total clips, shoot dates, cameras, scenes, CDL count) for a project''s source media. Avoids loading all rows client-side.';
