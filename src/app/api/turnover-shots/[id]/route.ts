import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireAdmin, getServiceClient } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) return auth.error;
    
    // Only admins/supervisors can remove shots from turnovers
    const roleCheck = requireAdmin(auth.user);
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const supabase = getServiceClient();

    // Delete turnover_shot_refs first (foreign key constraint)
    await supabase
      .from("turnover_shot_refs")
      .delete()
      .eq("turnover_shot_id", id);

    // Delete the turnover_shot
    const { error } = await supabase
      .from("turnover_shots")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete turnover shot error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete turnover shot error:", error);
    return NextResponse.json({ error: "Failed to remove shot from turnover" }, { status: 500 });
  }
}
