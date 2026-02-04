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

    if (existingAuth) {
      // User exists in auth — upsert public.users and update role
      const { data: user, error: upsertError } = await adminClient
        .from("users")
        .upsert(
          { auth_id: existingAuth.id, email, name: name || null, role },
          { onConflict: "email" }
        )
        .select()
        .single();

      if (upsertError) {
        return NextResponse.json(
          { error: `Failed to update user: ${upsertError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        user,
        message: "User already exists, role updated",
      });
    }

    // New user — send invite email via Supabase Auth
    const { data: authData, error: authError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { name, role },
      });

    if (authError) {
      console.error("Auth invite error:", JSON.stringify(authError));
      return NextResponse.json(
        { error: `Invite failed: ${authError.message}` },
        { status: 500 }
      );
    }

    // The handle_new_user trigger on auth.users will auto-create 
    // the public.users record. Update it with the correct role/name.
    if (authData?.user) {
      // Small delay to let the trigger fire
      await new Promise(r => setTimeout(r, 500));

      const { error: updateError } = await adminClient
        .from("users")
        .update({ name: name || null, role })
        .eq("auth_id", authData.user.id);

      if (updateError) {
        // Trigger might not have fired yet — try upsert by email
        await adminClient
          .from("users")
          .upsert(
            { auth_id: authData.user.id, email, name: name || null, role },
            { onConflict: "email" }
          );
      }
    }

    return NextResponse.json({
      user: authData?.user
        ? { id: authData.user.id, email, name, role }
        : null,
      message: "Invite email sent",
    });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
