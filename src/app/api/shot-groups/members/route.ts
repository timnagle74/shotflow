import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireInternal, getServiceClient } from "@/lib/auth";

// POST /api/shot-groups/members - Add shots to a group
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;
  const roleCheck = requireInternal(auth.user);
  if (roleCheck) return roleCheck;

  const body = await req.json();
  const { groupId, shotIds } = body;

  if (!groupId || !shotIds || shotIds.length === 0) {
    return NextResponse.json({ error: "groupId and shotIds required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const members = shotIds.map((shotId: string) => ({
    shot_group_id: groupId,
    shot_id: shotId,
  }));

  const { data, error } = await supabase
    .from("shot_group_members")
    .upsert(members, { onConflict: "shot_group_id,shot_id" })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/shot-groups/members - Remove shots from a group
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;
  const roleCheck = requireInternal(auth.user);
  if (roleCheck) return roleCheck;

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const shotId = searchParams.get("shotId");

  if (!groupId || !shotId) {
    return NextResponse.json({ error: "groupId and shotId required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { error } = await supabase
    .from("shot_group_members")
    .delete()
    .eq("shot_group_id", groupId)
    .eq("shot_id", shotId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
