-- Notification Subscriptions for email alerts on version uploads
-- Users can subscribe to specific projects or all projects (null project_id)

CREATE TABLE notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  notify_on_version_upload BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Unique constraint: one subscription per user per project (or one "all projects" per user)
  UNIQUE(user_id, project_id)
);

-- Index for efficient lookups when sending notifications
CREATE INDEX idx_notification_subscriptions_user ON notification_subscriptions(user_id);
CREATE INDEX idx_notification_subscriptions_project ON notification_subscriptions(project_id) WHERE project_id IS NOT NULL;

-- RLS Policies
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON notification_subscriptions FOR SELECT
  USING (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

-- Users can insert their own subscriptions
CREATE POLICY "Users can create own subscriptions"
  ON notification_subscriptions FOR INSERT
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

-- Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions"
  ON notification_subscriptions FOR UPDATE
  USING (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions"
  ON notification_subscriptions FOR DELETE
  USING (user_id IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  ));

-- Service role bypass for edge functions
CREATE POLICY "Service role full access"
  ON notification_subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE notification_subscriptions IS 'Email notification preferences per user/project';
COMMENT ON COLUMN notification_subscriptions.project_id IS 'NULL means subscribe to ALL projects';
