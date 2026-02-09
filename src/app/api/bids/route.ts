import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Get bids for a bid request
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bidRequestId = searchParams.get("bidRequestId");

  if (!bidRequestId) {
    return NextResponse.json({ error: "bidRequestId required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bids")
    .select(`
      *,
      submitted_by_user:users!submitted_by(id, name, email)
    `)
    .eq("bid_request_id", bidRequestId)
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Submit a bid (vendor action)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bidRequestId, priceCents, currency, timelineDays, timelineNotes, notes, submittedBy } = body;

  if (!bidRequestId) {
    return NextResponse.json({ error: "bidRequestId required" }, { status: 400 });
  }

  // Create the bid
  const { data: bid, error: bidError } = await supabase
    .from("bids")
    .insert({
      bid_request_id: bidRequestId,
      price_cents: priceCents || null,
      currency: currency || "USD",
      timeline_days: timelineDays || null,
      timeline_notes: timelineNotes || null,
      notes: notes || null,
      submitted_by: submittedBy || null,
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (bidError) {
    return NextResponse.json({ error: bidError.message }, { status: 500 });
  }

  // Update bid request status to 'submitted'
  await supabase
    .from("bid_requests")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("id", bidRequestId);

  // TODO: Notify producer that a bid was submitted

  return NextResponse.json(bid);
}

// PATCH: Update a bid (vendor can revise before deadline)
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, priceCents, currency, timelineDays, timelineNotes, notes } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const updateData: any = { updated_at: new Date().toISOString() };
  if (priceCents !== undefined) updateData.price_cents = priceCents;
  if (currency !== undefined) updateData.currency = currency;
  if (timelineDays !== undefined) updateData.timeline_days = timelineDays;
  if (timelineNotes !== undefined) updateData.timeline_notes = timelineNotes;
  if (notes !== undefined) updateData.notes = notes;

  const { data, error } = await supabase
    .from("bids")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
