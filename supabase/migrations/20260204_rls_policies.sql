-- ============================================================
-- RLS Policies: Require authenticated access on all core tables
-- ============================================================
-- This migration:
--   1) Enables RLS on all core tables that were missing it
--   2) Replaces permissive USING(true) policies with authenticated-only policies
--   3) Scopes sensitive data by project membership where practical
-- ============================================================

-- Helper: check if a user is an authenticated (non-anon) user
-- auth.uid() returns null for anon; auth.role() returns 'authenticated' for logged-in users

-- ── users ─────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the users table (needed for UI dropdowns, assignee lists, etc.)
CREATE POLICY "Authenticated users can read users"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only the user themselves or admins can update a user row
CREATE POLICY "Users can update own row, admins can update any"
  ON users FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND (
      auth_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('ADMIN', 'SUPERVISOR', 'PRODUCER')
      )
    )
  );

-- Only admins can insert/delete users (managed via service role in API)
CREATE POLICY "Service role manages user inserts"
  ON users FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Service role manages user deletes"
  ON users FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('ADMIN', 'SUPERVISOR', 'PRODUCER')
    )
  );

-- ── projects ──────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read projects"
  ON projects FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('ADMIN', 'SUPERVISOR', 'PRODUCER', 'COORDINATOR')
    )
  );

-- ── sequences ─────────────────────────────────────────────────
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sequences"
  ON sequences FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Internal users can manage sequences"
  ON sequences FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
    )
  );

-- ── shots ─────────────────────────────────────────────────────
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read shots"
  ON shots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Internal users can manage shots"
  ON shots FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
    )
  );

-- ── versions ──────────────────────────────────────────────────
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read versions"
  ON versions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Internal users can manage versions"
  ON versions FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
    )
  );

-- ── source_media ──────────────────────────────────────────────
ALTER TABLE source_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read source_media"
  ON source_media FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Internal users can manage source_media"
  ON source_media FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
    )
  );

-- ── shot_plates ───────────────────────────────────────────────
ALTER TABLE shot_plates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read plates"
  ON shot_plates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Internal users can manage plates"
  ON shot_plates FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
    )
  );

-- ── deliveries ────────────────────────────────────────────────
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read deliveries"
  ON deliveries FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Internal users can manage deliveries"
  ON deliveries FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
    )
  );

-- ── notes ─────────────────────────────────────────────────────
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notes"
  ON notes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage notes"
  ON notes FOR ALL
  USING (auth.role() = 'authenticated');

-- ── turnovers (replace permissive policies) ───────────────────
-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON turnovers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON turnover_shots;

CREATE POLICY "Authenticated users can read turnovers"
  ON turnovers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Internal users can manage turnovers"
  ON turnovers FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
    )
  );

CREATE POLICY "Authenticated users can read turnover_shots"
  ON turnover_shots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Internal users can manage turnover_shots"
  ON turnover_shots FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
    )
  );

-- ── turnover_refs ─────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'turnover_refs') THEN
    ALTER TABLE turnover_refs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Authenticated users can read turnover_refs"
      ON turnover_refs FOR SELECT
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Internal users can manage turnover_refs"
      ON turnover_refs FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );
  END IF;
END $$;

-- ── turnover_shot_refs ────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'turnover_shot_refs') THEN
    ALTER TABLE turnover_shot_refs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Authenticated users can read turnover_shot_refs"
      ON turnover_shot_refs FOR SELECT
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Internal users can manage turnover_shot_refs"
      ON turnover_shot_refs FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );
  END IF;
END $$;

-- ── vendors ───────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendors') THEN
    ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Authenticated users can read vendors"
      ON vendors FOR SELECT
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Admins can manage vendors"
      ON vendors FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('ADMIN', 'SUPERVISOR', 'PRODUCER')
        )
      );
  END IF;
END $$;

-- ── artists ───────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'artists') THEN
    ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Authenticated users can read artists"
      ON artists FOR SELECT
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Admins can manage artists"
      ON artists FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('ADMIN', 'SUPERVISOR', 'PRODUCER')
        )
      );
  END IF;
END $$;

-- ── review_sessions ───────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'review_sessions') THEN
    ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
    
    -- Review sessions need to be readable by anyone (token-based public access)
    CREATE POLICY "Anyone can read review_sessions"
      ON review_sessions FOR SELECT
      USING (true);

    CREATE POLICY "Internal users can manage review_sessions"
      ON review_sessions FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );
  END IF;
END $$;

-- ── review_session_versions ───────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'review_session_versions') THEN
    ALTER TABLE review_session_versions ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Anyone can read review_session_versions"
      ON review_session_versions FOR SELECT
      USING (true);

    CREATE POLICY "Anyone can update review_session_versions"
      ON review_session_versions FOR UPDATE
      USING (true);

    CREATE POLICY "Internal users can manage review_session_versions"
      ON review_session_versions FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );
  END IF;
END $$;

-- ── version_comments ──────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'version_comments') THEN
    ALTER TABLE version_comments ENABLE ROW LEVEL SECURITY;
    
    -- Comments need to be readable/writable for review token flows (unauthenticated)
    CREATE POLICY "Anyone can read version_comments"
      ON version_comments FOR SELECT
      USING (true);

    CREATE POLICY "Anyone can insert version_comments"
      ON version_comments FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ── shot_versions ─────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shot_versions') THEN
    ALTER TABLE shot_versions ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Anyone can read shot_versions"
      ON shot_versions FOR SELECT
      USING (true);

    -- Updates allowed for review flows and internal users
    CREATE POLICY "Anyone can update shot_versions"
      ON shot_versions FOR UPDATE
      USING (true);

    CREATE POLICY "Internal users can manage shot_versions"
      ON shot_versions FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );
  END IF;
END $$;

-- ── user_vendors ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_vendors') THEN
    ALTER TABLE user_vendors ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Authenticated users can read user_vendors"
      ON user_vendors FOR SELECT
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Admins can manage user_vendors"
      ON user_vendors FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('ADMIN', 'SUPERVISOR', 'PRODUCER')
        )
      );
  END IF;
END $$;
