import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/database.types";
import { authenticateRequest, requireAdmin, getServiceClient } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth: only ADMIN/SUPERVISOR/PRODUCER can add artists to vendors
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const roleCheck = requireAdmin(auth.user);
    if (roleCheck) return roleCheck;

    const vendorId = params.id;
    const { name, email, specialty } = (await req.json()) as {
      name: string;
      email: string;
      specialty?: string;
    };

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const adminClient = getServiceClient() as any;

    // Verify vendor exists
    const { data: vendor, error: vendorError } = await adminClient
      .from("vendors")
      .select("id, name")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // 1. Create artist record linked to vendor (include email for matching)
    const { data: artist, error: artistError } = await adminClient
      .from("artists")
      .insert({
        name,
        email,
        vendor_id: vendorId,
        role: specialty || null,
        active: true,
      })
      .select()
      .single();

    if (artistError) {
      return NextResponse.json(
        { error: `Failed to create artist: ${artistError.message}` },
        { status: 500 }
      );
    }

    // 2. Invite user via Supabase Auth
    const userRole: UserRole = "ARTIST";
    let userId: string | null = null;

    const { data: authData, error: authError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { name, role: userRole },
      });

    if (authError) {
      if (
        authError.message?.includes("already been registered") ||
        authError.message?.includes("already exists")
      ) {
        const { data: existingUsers } =
          await adminClient.auth.admin.listUsers();
        const existingAuth = existingUsers?.users?.find(
          (u: any) => u.email === email
        );
        if (existingAuth) {
          userId = existingAuth.id;
        }
      }
      if (!userId) {
        // Still create the artist record even if auth invite fails
        return NextResponse.json({
          artist,
          user: null,
          message: `Artist "${name}" created. Auth invite failed: ${authError.message}`,
        });
      }
    } else if (authData?.user) {
      userId = authData.user.id;
    }

    if (userId) {
      // 3. Upsert user record with vendor_id
      // userId here is auth.users.id — upsert by auth_id, NOT public.users.id
      const { data: upsertedUser } = await adminClient
        .from("users")
        .upsert(
          {
            auth_id: userId,
            email,
            name,
            role: userRole,
            vendor_id: vendorId,
          },
          { onConflict: "auth_id" }
        )
        .select("id")
        .single();

      // 4. Link user to vendor via junction table (using public.users.id)
      const publicUserId = upsertedUser?.id;
      if (publicUserId) {
        await adminClient
          .from("user_vendors")
          .upsert(
            { user_id: publicUserId, vendor_id: vendorId },
            { onConflict: "user_id,vendor_id", ignoreDuplicates: true }
          );

        // 5. Link artist record to user via user_id column
        await adminClient
          .from("artists")
          .update({ user_id: publicUserId })
          .eq("id", artist.id);
      }
    }

    return NextResponse.json({
      artist,
      user: userId ? { email, name, role: userRole } : null,
      message: `Artist "${name}" invited and linked to ${vendor.name}`,
    });
  } catch (err) {
    console.error("Artist invite error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
