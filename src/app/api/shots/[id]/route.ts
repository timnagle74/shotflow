import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireAdmin, getServiceClient } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    
    // Only admins/supervisors can delete shots
    const roleCheck = requireAdmin(auth.user);
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const supabase = getServiceClient();

    // Delete in order due to foreign key constraints:
    // 1. shot_plates
    // 2. versions (and their related data)
    // 3. turnover_shots (and turnover_shot_refs)
    // 4. shot itself

    // Delete shot_plates
    await supabase
      .from("shot_plates")
      .delete()
      .eq("shot_id", id);

    // Get version ids for this shot
    const { data: versions } = await supabase
      .from("versions")
      .select("id")
      .eq("shot_id", id);

    const versionIds = (versions || []).map((v: any) => v.id);

    // Delete version-related data
    if (versionIds.length > 0) {
      // Delete frame_annotations
      await supabase
        .from("frame_annotations")
        .delete()
        .in("version_id", versionIds);

      // Delete version_status_history
      await supabase
        .from("version_status_history")
        .delete()
        .in("version_id", versionIds);

      // Delete versions
      await supabase
        .from("versions")
        .delete()
        .eq("shot_id", id);
    }

    // Get turnover_shot ids
    const { data: turnoverShots } = await supabase
      .from("turnover_shots")
      .select("id")
      .eq("shot_id", id);

    const turnoverShotIds = (turnoverShots || []).map((ts: any) => ts.id);

    // Delete turnover_shot_refs
    if (turnoverShotIds.length > 0) {
      await supabase
        .from("turnover_shot_refs")
        .delete()
        .in("turnover_shot_id", turnoverShotIds);
    }

    // Delete turnover_shots
    await supabase
      .from("turnover_shots")
      .delete()
      .eq("shot_id", id);

    // Delete the shot itself
    const { error } = await supabase
      .from("shots")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete shot error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete shot error:", error);
    return NextResponse.json({ error: "Failed to delete shot" }, { status: 500 });
  }
}
