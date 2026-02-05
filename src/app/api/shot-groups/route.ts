import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireInternal, getServiceClient } from "@/lib/auth";

// GET /api/shot-groups?projectId=xxx or ?sequenceId=xxx
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const sequenceId = searchParams.get("sequenceId");

  const supabase = getServiceClient();

  let query = supabase
    .from("shot_groups")
    .select(`
      *,
      shot_group_members(shot_id, shots(id, code)),
      shot_group_plates(id, filename, cdn_url),
      shot_group_refs(id, filename, cdn_url)
    `)
    .order("name");

  if (sequenceId) {
    query = query.eq("sequence_id", sequenceId);
  } else if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/shot-groups - Create a new group
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;
  const roleCheck = requireInternal(auth.user);
  if (roleCheck) return roleCheck;

  const body = await req.json();
  const { projectId, sequenceId, name, description, color, shotIds } = body;

  if (!projectId || !name) {
    return NextResponse.json({ error: "projectId and name required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Create the group
  const { data: group, error: groupError } = await supabase
    .from("shot_groups")
    .insert({
      project_id: projectId,
      sequence_id: sequenceId || null,
      name,
      description: description || null,
      color: color || "#6366f1",
    })
    .select()
    .single();

  if (groupError) {
    return NextResponse.json({ error: groupError.message }, { status: 500 });
  }

  // Add initial shots if provided
  if (shotIds && shotIds.length > 0) {
    const members = shotIds.map((shotId: string) => ({
      shot_group_id: group.id,
      shot_id: shotId,
    }));

    await supabase.from("shot_group_members").insert(members);
  }

  return NextResponse.json(group);
}

// DELETE /api/shot-groups?id=xxx - Delete a group
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;
  const roleCheck = requireInternal(auth.user);
  if (roleCheck) return roleCheck;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { error } = await supabase.from("shot_groups").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
