import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { authenticateRequest, requireAdmin, getServiceClient } from "@/lib/auth";

// PATCH /api/users/[id] — update user role / name
// NOTE: [id] is public.users.id, NOT auth.users.id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: only ADMIN/SUPERVISOR/PRODUCER can update users
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const roleCheck = requireAdmin(auth.user);
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const body = await req.json();
    const adminClient = getServiceClient();

    const update: Record<string, unknown> = {};
    if (body.role) update.role = body.role;
    if (body.name !== undefined) update.name = body.name;
    if (body.can_view_all_shots !== undefined)
      update.can_view_all_shots = body.can_view_all_shots;

    // Update public.users row using public.users.id
    const { data, error } = await (adminClient as any)
      .from("users")
      .update(update)
      .eq("id", id)
      .select("*, auth_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also update auth metadata if role changed — use auth_id (NOT public.users.id)
    if (body.role && data?.auth_id) {
      await adminClient.auth.admin.updateUserById(data.auth_id, {
        user_metadata: { role: body.role },
      });
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    console.error("Update user error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] — deactivate user (ban in auth, mark inactive)
// NOTE: [id] is public.users.id, NOT auth.users.id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: only ADMIN/SUPERVISOR/PRODUCER can delete users
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const roleCheck = requireAdmin(auth.user);
    if (roleCheck) return roleCheck;

    const { id } = await params;
    const adminClient = getServiceClient();

    // Look up the auth_id from the public.users row first
    const { data: userData, error: lookupError } = await adminClient
      .from("users")
      .select("auth_id")
      .eq("id", id)
      .single();

    if (lookupError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Ban user in auth using auth_id (NOT public.users.id)
    if (userData.auth_id) {
      const { error: banError } = await adminClient.auth.admin.updateUserById(
        userData.auth_id,
        { ban_duration: "876000h" } // ~100 years
      );

      if (banError) {
        console.error("Failed to ban user:", banError);
      }
    }

    // Delete the public.users row using public.users.id
    const { error: deleteError } = await adminClient
      .from("users")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
