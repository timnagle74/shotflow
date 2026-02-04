import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/database.types";
import { authenticateRequest, requireAdmin, getServiceClient } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Auth: only ADMIN/SUPERVISOR/PRODUCER can invite vendors
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const roleCheck = requireAdmin(auth.user);
    if (roleCheck) return roleCheck;

    const body = await req.json();
    const {
      companyName,
      contactName,
      contactEmail,
      isFreelancer,
      projectId,
    } = body as {
      companyName?: string;
      contactName: string;
      contactEmail: string;
      isFreelancer: boolean;
      projectId?: string;
    };

    if (!contactName || !contactEmail) {
      return NextResponse.json(
        { error: "Contact name and email are required" },
        { status: 400 }
      );
    }

    if (!isFreelancer && !companyName) {
      return NextResponse.json(
        { error: "Company name is required for non-freelancer vendors" },
        { status: 400 }
      );
    }

    const adminClient = getServiceClient() as any;

    // Determine vendor name and user role
    const vendorName = isFreelancer
      ? `${contactName} VFX`
      : companyName!;
    const userRole: UserRole = isFreelancer ? "ARTIST" : "VFX_VENDOR";

    // Generate a vendor code from the name (uppercase, no spaces, max 10 chars)
    const vendorCode = vendorName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10);

    // 1. Create vendor record (project_id is optional — vendors can be global)
    const { data: vendor, error: vendorError } = await adminClient
      .from("vendors")
      .insert({
        name: vendorName,
        code: vendorCode,
        contact_name: contactName,
        contact_email: contactEmail,
        project_id: projectId || null,
        active: true,
      })
      .select()
      .single();

    if (vendorError) {
      return NextResponse.json(
        { error: `Failed to create vendor: ${vendorError.message}` },
        { status: 500 }
      );
    }

    // 2. Invite user via Supabase Auth (or find existing)
    let userId: string | null = null;

    const { data: authData, error: authError } =
      await adminClient.auth.admin.inviteUserByEmail(contactEmail, {
        data: { name: contactName, role: userRole },
      });

    if (authError) {
      if (
        authError.message?.includes("already been registered") ||
        authError.message?.includes("already exists")
      ) {
        // User already exists in auth — find them
        const { data: existingUsers } =
          await adminClient.auth.admin.listUsers();
        const existingAuth = existingUsers?.users?.find(
          (u: any) => u.email === contactEmail
        );

        if (existingAuth) {
          userId = existingAuth.id;
        } else {
          // Cleanup vendor on failure
          await adminClient.from("vendors").delete().eq("id", vendor.id);
          return NextResponse.json(
            { error: "User exists in auth but could not be found" },
            { status: 400 }
          );
        }
      } else {
        // Cleanup vendor on failure
        await adminClient.from("vendors").delete().eq("id", vendor.id);
        return NextResponse.json(
          { error: authError.message },
          { status: 500 }
        );
      }
    } else if (authData?.user) {
      userId = authData.user.id;
    }

    if (!userId) {
      await adminClient.from("vendors").delete().eq("id", vendor.id);
      return NextResponse.json(
        { error: "Failed to create or find user" },
        { status: 500 }
      );
    }

    // 3. Upsert user record in users table with vendor_id
    // userId here is auth.users.id — upsert by auth_id (NOT by public.users.id)
    const { data: user, error: userError } = await adminClient
      .from("users")
      .upsert(
        {
          auth_id: userId,
          email: contactEmail,
          name: contactName,
          role: userRole,
          vendor_id: vendor.id,
        },
        { onConflict: "auth_id" }
      )
      .select()
      .single();

    if (userError) {
      console.error("Failed to upsert user:", userError);
    }

    // 4. Link user to vendor via user_vendors junction table
    // Use the public.users.id (from upsert result), NOT auth.users.id
    const publicUserId = user?.id;
    if (publicUserId) {
      const { error: junctionError } = await adminClient
        .from("user_vendors")
        .upsert(
          {
            user_id: publicUserId,
            vendor_id: vendor.id,
          },
          { onConflict: "user_id,vendor_id", ignoreDuplicates: true }
        );

      if (junctionError) {
        console.error("Failed to create user_vendors link:", junctionError);
      }
    }

    return NextResponse.json({
      vendor,
      user: user || { email: contactEmail, name: contactName, role: userRole },
      message: isFreelancer
        ? `Freelancer "${contactName}" invited with auto-vendor "${vendorName}"`
        : `Vendor "${vendorName}" created and ${contactName} invited`,
    });
  } catch (err) {
    console.error("Vendor invite error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
