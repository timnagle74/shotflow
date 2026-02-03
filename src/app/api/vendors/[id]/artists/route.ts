import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/database.types";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as any;

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

    // 1. Create artist record linked to vendor
    const { data: artist, error: artistError } = await adminClient
      .from("artists")
      .insert({
        name,
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
      await adminClient
        .from("users")
        .upsert(
          {
            id: userId,
            email,
            name,
            role: userRole,
            vendor_id: vendorId,
          },
          { onConflict: "id" }
        );

      // 4. Link user to vendor via junction table
      await adminClient
        .from("user_vendors")
        .upsert(
          { user_id: userId, vendor_id: vendorId },
          { onConflict: "user_id,vendor_id", ignoreDuplicates: true }
        );

      // 5. Update artist record with user_id if column exists
      await adminClient
        .from("artists")
        .update({ user_id: userId })
        .eq("id", artist.id);
    }

    return NextResponse.json({
      artist,
      user: userId ? { id: userId, email, name, role: userRole } : null,
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
