-- Bid Request Shots - Junction table for flexible shot bidding
-- Allows bidding on individual shots, groups, or entire turnovers

CREATE TABLE IF NOT EXISTS bid_request_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_request_id UUID NOT NULL REFERENCES bid_requests(id) ON DELETE CASCADE,
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bid_request_id, shot_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bid_request_shots_request ON bid_request_shots(bid_request_id);
CREATE INDEX IF NOT EXISTS idx_bid_request_shots_shot ON bid_request_shots(shot_id);

-- Enable RLS
ALTER TABLE bid_request_shots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON bid_request_shots FOR ALL USING (auth.role() = 'authenticated');

-- Make turnover_id nullable (for shot-only bids)
ALTER TABLE bid_requests ALTER COLUMN turnover_id DROP NOT NULL;

-- Add project_id and title for shot-only bids
ALTER TABLE bid_requests ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE bid_requests ADD COLUMN IF NOT EXISTS title TEXT;
