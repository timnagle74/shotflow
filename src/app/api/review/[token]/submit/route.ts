import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const body = await request.json();
    const { versionId, status, reviewerName } = body;

    if (!versionId || !status || !reviewerName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session
    const { data: session } = await supabase
      .from("review_sessions")
      .select("id, allow_approvals, expires_at")
      .eq("access_token", token)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 404 });
    }

    if (!session.allow_approvals) {
      return NextResponse.json({ error: "Approvals not allowed" }, { status: 403 });
    }

    // SECURITY: Verify that the versionId belongs to this review session
    const { data: sessionVersion, error: svError } = await supabase
      .from("review_session_versions")
      .select("id")
      .eq("session_id", session.id)
      .eq("version_id", versionId)
      .single();

    if (svError || !sessionVersion) {
      return NextResponse.json(
        { error: "Version not found in this review session" },
        { status: 403 }
      );
    }

    // Update review_session_versions
    const { error: updateError } = await supabase
      .from("review_session_versions")
      .update({
        client_status: status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("session_id", session.id)
      .eq("version_id", versionId);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
    }

    // Also update the shot_version status
    const newStatus = status === 'approved' ? 'approved' 
                    : status === 'rejected' ? 'rejected'
                    : 'needs_changes';

    await supabase
      .from("shot_versions")
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        review_notes: `Client review by ${reviewerName}: ${status}`,
      })
      .eq("id", versionId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Submit review error:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
