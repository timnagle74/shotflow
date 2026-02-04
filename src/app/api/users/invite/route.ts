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

    // First check if auth user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingAuth = existingUsers?.users?.find(
      (u: any) => u.email === email
    );

    let authUserId: string;

    if (existingAuth) {
      authUserId = existingAuth.id;
    } else {
      // Create auth user with a temporary password (they'll reset on first login)
      const tempPassword = crypto.randomUUID() + "!Aa1";
      const { data: authData, error: authError } =
        await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name, role },
        });

      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: 500 }
        );
      }

      authUserId = authData.user.id;
    }

    // Upsert into public.users table
    const { data: user, error: upsertError } = await adminClient
      .from("users")
      .upsert(
        {
          id: authUserId,
          email,
          name: name || null,
          role,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json(
        { error: `Database error saving new user: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: user || { id: authUserId, email, name, role },
      message: existingAuth ? "User already existed, role updated" : "User created successfully",
    });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
