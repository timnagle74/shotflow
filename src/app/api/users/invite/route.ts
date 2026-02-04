import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/database.types";

export async function POST(req: NextRequest) {
  try {
    const { email, name, role } = (await req.json()) as {
      email: string;
      name: string;
      role: UserRole;
    };

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server not configured for user management" },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as any;

    // Check if auth user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingAuth = existingUsers?.users?.find(
      (u: any) => u.email === email
    );

    let authUserId: string;
    let isNew = false;

    if (existingAuth) {
      authUserId = existingAuth.id;
    } else {
      // Create auth user and send them a password reset to set up their account
      const tempPassword = crypto.randomUUID() + "!Aa1";
      const { data: authData, error: createError } =
        await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name, role },
        });

      if (createError) {
        console.error("Auth create error:", JSON.stringify(createError));
        return NextResponse.json(
          { error: `Failed to create user: ${createError.message}` },
          { status: 500 }
        );
      }

      authUserId = authData.user.id;
      isNew = true;

      // Send password recovery email so they can set their own password
      const { error: resetError } =
        await adminClient.auth.admin.generateLink({
          type: "recovery",
          email,
        });

      if (resetError) {
        console.error("Recovery email error:", JSON.stringify(resetError));
        // Don't fail — user was created, they can use "forgot password" later
      }
    }

    // Upsert into public.users table
    const { data: user, error: upsertError } = await adminClient
      .from("users")
      .upsert(
        {
          id: authUserId,
          auth_id: authUserId,
          email,
          name: name || null,
          role,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (upsertError) {
      // Try with just auth_id match if id conflict
      const { data: user2, error: upsertError2 } = await adminClient
        .from("users")
        .upsert(
          {
            auth_id: authUserId,
            email,
            name: name || null,
            role,
          },
          { onConflict: "email" }
        )
        .select()
        .single();

      if (upsertError2) {
        return NextResponse.json(
          { error: `Database error: ${upsertError2.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        user: user2,
        message: isNew ? "User created (invite email pending SMTP setup)" : "User updated",
      });
    }

    return NextResponse.json({
      user: user || { id: authUserId, email, name, role },
      message: isNew ? "User created (invite email pending SMTP setup)" : "User updated",
    });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
