import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, validateReviewToken } from "@/lib/auth";

// Valid status values for client review
const VALID_STATUSES = ['approved', 'rejected', 'needs_changes'] as const;
type ReviewStatus = typeof VALID_STATUSES[number];

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

    // Validate status is one of the allowed values
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate token via centralized auth helper (requires approvals)
    const tokenResult = await validateReviewToken(token, { requireApprovals: true });
    if (tokenResult.error) return tokenResult.error;

    const supabase = getServiceClient();

    // SECURITY: Verify that the versionId belongs to this review session
    const { data: sessionVersion, error: svError } = await supabase
      .from("review_session_versions")
      .select("id")
      .eq("session_id", tokenResult.session.id)
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
      .eq("session_id", tokenResult.session.id)
      .eq("version_id", versionId);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
    }

    // Also update the shot_version status
    const newStatus: ReviewStatus = status;

    const { error: versionError } = await supabase
      .from("shot_versions")
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        review_notes: `Client review by ${reviewerName}: ${status}`,
      })
      .eq("id", versionId);

    if (versionError) {
      console.error("shot_versions update error:", versionError);
      // Non-fatal - the review_session_versions was updated successfully
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Submit review error:", error);
    return NextResponse.json({ error: "Failed to submit review" }, { status: 500 });
  }
}
