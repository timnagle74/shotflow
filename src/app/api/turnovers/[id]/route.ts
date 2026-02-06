import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireAdmin, getServiceClient } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    
    // Only admins/supervisors can delete turnovers
    const roleCheck = requireAdmin(auth.user);
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const supabase = getServiceClient();

    // Delete in order due to foreign key constraints:
    // 1. turnover_shot_refs (refs junction to turnover_shots)
    // 2. turnover_shots
    // 3. turnover_refs
    // 4. turnovers

    // Get turnover_shot ids first
    const { data: turnoverShots } = await supabase
      .from("turnover_shots")
      .select("id")
      .eq("turnover_id", id);

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
      .eq("turnover_id", id);

    // Delete turnover_refs
    await supabase
      .from("turnover_refs")
      .delete()
      .eq("turnover_id", id);

    // Delete the turnover itself
    const { error } = await supabase
      .from("turnovers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete turnover error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete turnover error:", error);
    return NextResponse.json({ error: "Failed to delete turnover" }, { status: 500 });
  }
}
