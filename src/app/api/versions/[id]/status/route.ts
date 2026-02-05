import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, getServiceClient } from "@/lib/auth";
import type { UserRole } from "@/lib/database.types";

// Roles that can approve/reject versions
const APPROVAL_ROLES: UserRole[] = [
  'ADMIN', 'VFX_SUPERVISOR', 'POST_SUPERVISOR', 'SUPERVISOR', 'PRODUCER'
];

// Roles that can submit for review (artist submits their own work)
const SUBMIT_ROLES: UserRole[] = [
  'ADMIN', 'VFX_SUPERVISOR', 'POST_SUPERVISOR', 'SUPERVISOR', 'PRODUCER', 
  'COORDINATOR', 'ARTIST', 'VFX_EDITOR', 'VFX_VENDOR'
];

type VersionStatus = 'WIP' | 'PENDING_REVIEW' | 'APPROVED' | 'REVISE' | 'CBB';

// Valid status transitions
const VALID_TRANSITIONS: Record<VersionStatus, VersionStatus[]> = {
  'WIP': ['PENDING_REVIEW'],
  'PENDING_REVIEW': ['APPROVED', 'REVISE', 'CBB', 'WIP'],
  'APPROVED': ['REVISE'], // Can un-approve if needed
  'REVISE': ['WIP', 'PENDING_REVIEW'],
  'CBB': ['APPROVED', 'REVISE', 'WIP'],
};

// PATCH /api/versions/[id]/status - Update version status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const { id: versionId } = await params;
  const body = await req.json();
  const { status, notes } = body as { status: VersionStatus; notes?: string };

  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Get current version
  const { data: version, error: fetchError } = await supabase
    .from("versions")
    .select("id, status, shot_id, created_by_id")
    .eq("id", versionId)
    .single();

  if (fetchError || !version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const currentStatus = version.status as VersionStatus;

  // Check if transition is valid
  if (!VALID_TRANSITIONS[currentStatus]?.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${currentStatus} to ${status}` },
      { status: 400 }
    );
  }

  // Check permissions based on action
  const isApprovalAction = ['APPROVED', 'REVISE', 'CBB'].includes(status);
  const isSubmitAction = status === 'PENDING_REVIEW';
  const isRetractAction = status === 'WIP' && currentStatus === 'PENDING_REVIEW';

  if (isApprovalAction && !APPROVAL_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "Only supervisors and above can approve/reject versions" },
      { status: 403 }
    );
  }

  if (isSubmitAction && !SUBMIT_ROLES.includes(auth.user.role)) {
    return NextResponse.json(
      { error: "You don't have permission to submit for review" },
      { status: 403 }
    );
  }

  // Require notes for revision requests
  if (status === 'REVISE' && !notes?.trim()) {
    return NextResponse.json(
      { error: "Notes are required when requesting revisions" },
      { status: 400 }
    );
  }

  // Update version status
  const { error: updateError } = await supabase
    .from("versions")
    .update({ status })
    .eq("id", versionId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Record in history
  const { error: historyError } = await supabase
    .from("version_status_history")
    .insert({
      version_id: versionId,
      from_status: currentStatus,
      to_status: status,
      changed_by_id: auth.user.userId,
      notes: notes || null,
    });

  if (historyError) {
    console.error("Failed to record status history:", historyError);
    // Don't fail the request, just log
  }

  // If approved, optionally update shot status to INTERNAL_REVIEW or CLIENT_REVIEW
  // (This is a policy decision - uncomment if desired)
  /*
  if (status === 'APPROVED') {
    await supabase
      .from("shots")
      .update({ status: 'INTERNAL_REVIEW' })
      .eq("id", version.shot_id)
      .in("status", ['NOT_STARTED', 'IN_PROGRESS']);
  }
  */

  return NextResponse.json({ 
    success: true, 
    version_id: versionId,
    from_status: currentStatus,
    to_status: status,
  });
}

// GET /api/versions/[id]/status - Get version status history
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const { id: versionId } = await params;
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("version_status_history")
    .select(`
      id,
      from_status,
      to_status,
      notes,
      created_at,
      changed_by:users(id, name, email, role)
    `)
    .eq("version_id", versionId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
