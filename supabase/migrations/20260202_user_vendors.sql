-- Link users to vendors: primary vendor_id on users table + junction table for multi-vendor freelancers

-- Add primary vendor_id to users (nullable — not everyone is a vendor)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_vendor ON users(vendor_id);

-- Junction table for freelancers who work with multiple vendors
CREATE TABLE IF NOT EXISTS user_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_user_vendors_user ON user_vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vendors_vendor ON user_vendors(vendor_id);

-- RLS
ALTER TABLE user_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON user_vendors
  FOR ALL USING (true) WITH CHECK (true);
