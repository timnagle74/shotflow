import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireAdmin, getServiceClient } from "@/lib/auth";
import type { UserRole } from "@/lib/database.types";

// GET /api/projects/[id]/members - List project team members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const { id: projectId } = await params;
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("project_members")
    .select(`
      id,
      role,
      created_at,
      user:users(id, name, email, avatar)
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/projects/[id]/members - Add a team member to project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const roleCheck = requireAdmin(auth.user);
  if (roleCheck) return roleCheck;

  const { id: projectId } = await params;
  const body = await req.json();
  const { user_id, role } = body as { user_id: string; role: UserRole };

  if (!user_id || !role) {
    return NextResponse.json(
      { error: "user_id and role are required" },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  // Check if user already has a role on this project
  const { data: existing } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user_id)
    .single();

  if (existing) {
    // Update existing role
    const { data, error } = await supabase
      .from("project_members")
      .update({ role })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }

  // Create new project member
  const { data, error } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id, role })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/projects/[id]/members?user_id=xxx - Remove a team member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (auth.error) return auth.error;

  const roleCheck = requireAdmin(auth.user);
  if (roleCheck) return roleCheck;

  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json(
      { error: "user_id query param is required" },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
