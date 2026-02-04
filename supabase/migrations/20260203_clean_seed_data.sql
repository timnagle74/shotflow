-- ============================================================================
-- ONE-TIME CLEANUP: Remove all seed/mock data from the database
-- 
-- This migration deletes all rows inserted by seed scripts during development.
-- It uses DELETE (not TRUNCATE) so that any triggers still fire normally.
-- Tables are deleted in reverse dependency order to respect foreign keys.
-- 
-- After this migration, the database starts completely clean.
-- Only real auth users (not matching the seed pattern) are preserved.
-- ============================================================================

-- 1. Version-related (deepest dependencies)
DELETE FROM version_comments;
DELETE FROM review_session_versions;
DELETE FROM review_sessions;
DELETE FROM version_status_history;
DELETE FROM shot_versions;

-- 2. Turnover-related
DELETE FROM turnover_shot_refs;
DELETE FROM turnover_refs;
DELETE FROM turnover_shots;

-- 3. Notes, deliveries, delivery specs
DELETE FROM notes;
DELETE FROM deliveries;
DELETE FROM delivery_specs;

-- 4. Shot auxiliary data
DELETE FROM shot_cdls;
DELETE FROM lut_files;
DELETE FROM shot_metadata;
DELETE FROM shot_plates;

-- 5. Core shot/sequence data
DELETE FROM shots;
DELETE FROM sequences;

-- 6. Turnovers and source media
DELETE FROM turnovers;
DELETE FROM source_media;

-- 7. Artist/vendor associations
DELETE FROM artists;
DELETE FROM user_vendors;

-- 8. Vendors
DELETE FROM vendors;

-- 9. Projects
DELETE FROM projects;

-- 10. Seed users only — identified by the 'a0000000' prefix pattern used in seed scripts
-- Real auth users (created through actual signup) are preserved
DELETE FROM users WHERE id LIKE 'a0000000%';

-- Also clean up the versions table (referenced by notes/deliveries, already cleared above)
DELETE FROM versions;
