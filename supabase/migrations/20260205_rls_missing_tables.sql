-- ============================================================
-- RLS Policies for delivery_specs, lut_files, shot_cdls, shot_metadata
-- ============================================================
-- These four tables were missing RLS entirely. Without RLS, any user
-- with the anon key (public in client JS) can read/write directly.
-- Follows the same pattern as 20260204_rls_policies.sql.
-- ============================================================

-- ── delivery_specs ────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_specs') THEN
    ALTER TABLE delivery_specs ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Authenticated users can read delivery_specs"
      ON delivery_specs FOR SELECT
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Internal users can manage delivery_specs"
      ON delivery_specs FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );
  END IF;
END $$;

-- ── lut_files ─────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lut_files') THEN
    ALTER TABLE lut_files ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Authenticated users can read lut_files"
      ON lut_files FOR SELECT
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Internal users can manage lut_files"
      ON lut_files FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );
  END IF;
END $$;

-- ── shot_cdls ─────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shot_cdls') THEN
    ALTER TABLE shot_cdls ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Authenticated users can read shot_cdls"
      ON shot_cdls FOR SELECT
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Internal users can manage shot_cdls"
      ON shot_cdls FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );
  END IF;
END $$;

-- ── shot_metadata ─────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shot_metadata') THEN
    ALTER TABLE shot_metadata ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Authenticated users can read shot_metadata"
      ON shot_metadata FOR SELECT
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Internal users can manage shot_metadata"
      ON shot_metadata FOR ALL
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );
  END IF;
END $$;
