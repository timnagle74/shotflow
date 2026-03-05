-- Notification batching/digest system
-- Instead of sending emails immediately, queue them and send digests every 5 minutes

-- Table to hold pending notifications until the next digest run
CREATE TABLE IF NOT EXISTS pending_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  created_by_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient digest queries (group by user)
CREATE INDEX IF NOT EXISTS idx_pending_notifications_user ON pending_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_notifications_created ON pending_notifications(created_at);

-- RLS Policies
ALTER TABLE pending_notifications ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (edge functions only)
DROP POLICY IF EXISTS "Service role full access" ON pending_notifications;
CREATE POLICY "Service role full access"
  ON pending_notifications FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE pending_notifications IS 'Queue for batched email notifications - processed every 5 minutes';

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the digest endpoint
-- Note: Service role key is embedded for pg_cron to authenticate to edge function
CREATE OR REPLACE FUNCTION call_notification_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://xwvqcloimcstevsmlbfb.supabase.co/functions/v1/send-notification-digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dnFjbG9pbWNzdGV2c21sYmZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU5NDU0NSwiZXhwIjoyMDg1MTcwNTQ1fQ.9Rs26QTwtMu53QOM3Rgw-M6gvrpXhznAnNQ7LVEFRD8',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Unschedule if exists (idempotent)
SELECT cron.unschedule('send-notification-digest') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-notification-digest'
);

-- Schedule the digest job to run every 5 minutes
SELECT cron.schedule(
  'send-notification-digest',
  '*/5 * * * *',
  $$SELECT call_notification_digest()$$
);
