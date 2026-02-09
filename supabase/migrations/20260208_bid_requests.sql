-- Bid Requests: Sent to vendors for quoting
CREATE TABLE IF NOT EXISTS bid_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turnover_id UUID NOT NULL REFERENCES turnovers(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'submitted', 'accepted', 'rejected', 'expired')),
  deadline TIMESTAMPTZ,
  notes TEXT, -- Notes from producer to vendor
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(turnover_id, vendor_id)
);

-- Bids: Vendor responses to bid requests
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_request_id UUID NOT NULL REFERENCES bid_requests(id) ON DELETE CASCADE,
  price_cents INTEGER, -- Price in cents for precision
  currency TEXT DEFAULT 'USD',
  timeline_days INTEGER, -- Estimated delivery in days
  timeline_notes TEXT, -- e.g., "2 weeks for first pass, 1 week revisions"
  notes TEXT, -- General notes/comments from vendor
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bid_requests_turnover ON bid_requests(turnover_id);
CREATE INDEX IF NOT EXISTS idx_bid_requests_vendor ON bid_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bid_requests_status ON bid_requests(status);
CREATE INDEX IF NOT EXISTS idx_bids_request ON bids(bid_request_id);

-- RLS Policies
ALTER TABLE bid_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Bid requests: viewable by admins and the vendor it's sent to
CREATE POLICY "bid_requests_select" ON bid_requests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND (u.role IN ('ADMIN', 'VFX_SUPERVISOR', 'POST_SUPERVISOR', 'PRODUCER') OR u.vendor_id = bid_requests.vendor_id)
  )
);

CREATE POLICY "bid_requests_insert" ON bid_requests FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.role IN ('ADMIN', 'VFX_SUPERVISOR', 'POST_SUPERVISOR', 'PRODUCER')
  )
);

CREATE POLICY "bid_requests_update" ON bid_requests FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND (u.role IN ('ADMIN', 'VFX_SUPERVISOR', 'POST_SUPERVISOR', 'PRODUCER') OR u.vendor_id = bid_requests.vendor_id)
  )
);

-- Bids: viewable by admins and the vendor who submitted
CREATE POLICY "bids_select" ON bids FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN bid_requests br ON br.id = bids.bid_request_id
    WHERE u.id = auth.uid()
    AND (u.role IN ('ADMIN', 'VFX_SUPERVISOR', 'POST_SUPERVISOR', 'PRODUCER') OR u.vendor_id = br.vendor_id)
  )
);

CREATE POLICY "bids_insert" ON bids FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    JOIN bid_requests br ON br.id = bid_request_id
    WHERE u.id = auth.uid()
    AND u.vendor_id = br.vendor_id
  )
);

CREATE POLICY "bids_update" ON bids FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN bid_requests br ON br.id = bids.bid_request_id
    WHERE u.id = auth.uid()
    AND u.vendor_id = br.vendor_id
  )
);
