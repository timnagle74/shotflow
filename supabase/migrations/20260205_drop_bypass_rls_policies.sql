-- Drop overly permissive "Allow all for authenticated users" RLS policies
-- that completely bypass role-based restrictions. These policies had
-- qual=true, with_check=true, cmd=ALL — meaning ANY authenticated user
-- (including CLIENT and VFX_VENDOR) could insert/update/delete ANY row.
--
-- The stricter role-based policies already exist on each table and provide
-- proper access control.

DROP POLICY IF EXISTS "Allow all for authenticated users" ON artists;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON review_session_versions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON review_sessions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON shot_versions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON turnover_refs;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON turnover_shot_refs;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON user_vendors;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON vendors;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON version_comments;

-- Drop unauthenticated open policies on turnovers/turnover_shots
-- These had qual=true with NO auth check, allowing even anon access.
DROP POLICY IF EXISTS "turnover_policy" ON turnovers;
DROP POLICY IF EXISTS "turnover_shots_policy" ON turnover_shots;
