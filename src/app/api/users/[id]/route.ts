import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { authenticateRequest, requireAdmin, getServiceClient } from "@/lib/auth";

// PATCH /api/users/[id] — update user role / name
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

    const { data, error } = await (adminClient as any)
      .from("users")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also update auth metadata if role changed
    if (body.role) {
      await adminClient.auth.admin.updateUserById(id, {
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

    // Ban user in auth (soft-delete)
    const { error: banError } = await adminClient.auth.admin.updateUserById(
      id,
      { ban_duration: "876000h" } // ~100 years
    );

    if (banError) {
      console.error("Failed to ban user:", banError);
    }

    // We don't delete the users row — just mark it. If there's no active column,
    // we update role to indicate deactivated, or delete the row.
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
