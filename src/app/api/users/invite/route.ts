import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/database.types";

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

    // Use `any` cast because our Database types don't cover the full schema
    // (turnovers table shape is out of date). This is fine for admin operations.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as any;

    // Try to invite via Supabase Auth
    const { data: authData, error: authError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { name, role },
      });

    if (authError) {
      // If user already exists in auth, just update the users table
      if (
        authError.message?.includes("already been registered") ||
        authError.message?.includes("already exists")
      ) {
        // Look up the existing auth user
        const { data: existingUsers } =
          await adminClient.auth.admin.listUsers();
        const existingAuth = existingUsers?.users?.find(
          (u: any) => u.email === email
        );

        if (existingAuth) {
          // Upsert into users table
          const { data: user, error: upsertError } = await adminClient
            .from("users")
            .upsert(
              {
                id: existingAuth.id,
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
              { error: upsertError.message },
              { status: 500 }
            );
          }

          return NextResponse.json({
            user,
            message: "User already exists, role updated",
          });
        }

        return NextResponse.json(
          { error: "User exists in auth but could not be found" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    // Auth invite succeeded — create user record in users table
    if (authData?.user) {
      const { error: insertError } = await adminClient.from("users").upsert(
        {
          id: authData.user.id,
          email,
          name: name || null,
          role,
        },
        { onConflict: "id" }
      );

      if (insertError) {
        console.error("Failed to create user record:", insertError);
      }
    }

    return NextResponse.json({
      user: authData?.user
        ? { id: authData.user.id, email, name, role }
        : null,
      message: "Invite sent successfully",
    });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
