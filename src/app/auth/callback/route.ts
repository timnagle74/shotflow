import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const access_token = searchParams.get("access_token");
  const refresh_token = searchParams.get("refresh_token");
  
  // Check for redirectTo in query params first, then cookie, then default
  const cookieStore = await cookies();
  const redirectCookie = cookieStore.get("authRedirectTo")?.value;
  const next = searchParams.get("redirectTo") ?? searchParams.get("next") ?? (redirectCookie ? decodeURIComponent(redirectCookie) : "/dashboard");

  const supabase = await createServerSupabaseClient();

  // Helper to create redirect response with cookie cleanup
  const createRedirectResponse = (url: string) => {
    const response = NextResponse.redirect(url);
    response.cookies.set("authRedirectTo", "", { maxAge: 0 });
    return response;
  };

  // Handle OAuth code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return createRedirectResponse(`${origin}${next}`);
    }
  }

  // Handle direct access token (from hash fragment redirect)
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (!error) {
      // Check the type param to determine where to redirect
      if (type === "invite" || type === "recovery") {
        return createRedirectResponse(`${origin}/setup-password`);
      }
      return createRedirectResponse(`${origin}${next}`);
    }
  }

  // Handle magic link / email OTP verification
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email" | "magiclink" | "recovery" | "invite" | "email_change",
    });
    
    if (!error) {
      // For invite or recovery tokens, redirect to password setup page
      if (type === "invite" || type === "recovery") {
        return createRedirectResponse(`${origin}/setup-password`);
      }
      return createRedirectResponse(`${origin}${next}`);
    }
  }

  // Redirect to login with error if something went wrong
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
