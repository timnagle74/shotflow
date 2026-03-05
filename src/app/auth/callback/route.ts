import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const access_token = searchParams.get("access_token");
  const refresh_token = searchParams.get("refresh_token");

  const supabase = await createServerSupabaseClient();

  // Handle OAuth code exchange (Google, etc.)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Redirect to client-side handler that reads localStorage for the final destination
      return NextResponse.redirect(`${origin}/auth/redirect`);
    }
  }

  // Handle direct access token (from hash fragment redirect)
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (!error) {
      if (type === "invite" || type === "recovery") {
        return NextResponse.redirect(`${origin}/setup-password`);
      }
      return NextResponse.redirect(`${origin}/auth/redirect`);
    }
  }

  // Handle magic link / email OTP verification
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email" | "magiclink" | "recovery" | "invite" | "email_change",
    });
    
    if (!error) {
      if (type === "invite" || type === "recovery") {
        return NextResponse.redirect(`${origin}/setup-password`);
      }
      return NextResponse.redirect(`${origin}/auth/redirect`);
    }
  }

  // Redirect to login with error if something went wrong
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
