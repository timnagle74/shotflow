import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: List bid requests (optionally filter by turnover_id or vendor_id)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const turnoverId = searchParams.get("turnoverId");
  const vendorId = searchParams.get("vendorId");

  let query = supabase
    .from("bid_requests")
    .select(`
      *,
      vendor:vendors(id, name, code),
      turnover:turnovers(
        id, 
        turnover_number, 
        title,
        project:projects(id, name, code)
      ),
      bids(*)
    `)
    .order("created_at", { ascending: false });

  if (turnoverId) {
    query = query.eq("turnover_id", turnoverId);
  }
  if (vendorId) {
    query = query.eq("vendor_id", vendorId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Create bid request(s) - send turnover to vendors for bidding
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { turnoverId, vendorIds, deadline, notes } = body;

  if (!turnoverId || !vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
    return NextResponse.json(
      { error: "turnoverId and vendorIds[] required" },
      { status: 400 }
    );
  }

  // Create bid requests for each vendor
  const bidRequests = vendorIds.map((vendorId: string) => ({
    turnover_id: turnoverId,
    vendor_id: vendorId,
    status: "pending",
    deadline: deadline || null,
    notes: notes || null,
  }));

  const { data, error } = await supabase
    .from("bid_requests")
    .upsert(bidRequests, { onConflict: "turnover_id,vendor_id" })
    .select(`
      *,
      vendor:vendors(id, name, code)
    `);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // TODO: Send email notifications to vendors

  return NextResponse.json(data);
}

// PATCH: Update bid request status (accept/reject)
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  const validStatuses = ["pending", "viewed", "submitted", "accepted", "rejected", "expired"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bid_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If accepted, optionally auto-assign vendor to shots
  if (status === "accepted" && data) {
    // Get turnover shots and assign to this vendor
    const { data: turnover } = await supabase
      .from("turnovers")
      .select("id, project_id")
      .eq("id", data.turnover_id)
      .single();

    // Could auto-create turnover_shots assignments here
  }

  return NextResponse.json(data);
}
