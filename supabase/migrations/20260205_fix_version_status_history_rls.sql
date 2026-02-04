-- ============================================================
-- Fix version_status_history RLS: replace permissive USING(true)
-- ============================================================
-- The old "Allow all for authenticated users" policy used USING(true)
-- WITH CHECK(true), meaning any authenticated user (including clients)
-- could read all history and insert arbitrary status changes.
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'version_status_history') THEN
    -- Drop the old permissive policy
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON version_status_history;

    -- Authenticated users can read status history (needed for version timeline UI)
    CREATE POLICY "Authenticated users can read version_status_history"
      ON version_status_history FOR SELECT
      USING (auth.role() = 'authenticated');

    -- Only internal users can insert/update/delete status history
    CREATE POLICY "Internal users can manage version_status_history"
      ON version_status_history FOR INSERT
      WITH CHECK (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );

    CREATE POLICY "Internal users can update version_status_history"
      ON version_status_history FOR UPDATE
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );

    CREATE POLICY "Internal users can delete version_status_history"
      ON version_status_history FOR DELETE
      USING (
        auth.role() = 'authenticated'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role NOT IN ('CLIENT', 'VFX_VENDOR')
        )
      );
  END IF;
END $$;
