import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/signup", "/auth/callback", "/client-login", "/api/thumbnail", "/review", "/api/review"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // If user is not authenticated and trying to access protected route
  if (!user && !isPublicRoute && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user is authenticated, check their role for route access
  if (user) {
    // Try to read role from auth metadata first (avoids DB query per request)
    let userRole: string | undefined = user.user_metadata?.role;

    // Fall back to DB lookup only if metadata is missing
    if (!userRole) {
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", user.id)
        .single();

      userRole = userData?.role;
    }
    const isClient = userRole === "CLIENT";
    const isVendor = userRole === "VFX_VENDOR";

    // Determine home route based on role
    const homeRoute = isClient ? "/client" : isVendor ? "/vendor" : "/dashboard";

    // Internal-only routes (not for clients or vendors)
    const internalOnlyRoutes = [
      "/dashboard",
      "/projects",
      "/shots",
      "/artists",
      "/vendors",
      "/deliveries",
      "/turnovers",
      "/turnover",
      "/reviews",
      "/users",
      "/source-media",
      "/color",
      "/settings",
      "/account",
    ];
    const isInternalOnlyRoute = internalOnlyRoutes.some((route) => 
      pathname.startsWith(route)
    );

    // If client tries to access internal routes, redirect to client portal
    if (isClient && isInternalOnlyRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/client";
      return NextResponse.redirect(url);
    }

    // If vendor tries to access internal routes, redirect to vendor portal
    if (isVendor && isInternalOnlyRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/vendor";
      return NextResponse.redirect(url);
    }

    // If client hits root, redirect to client portal
    if (isClient && pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/client";
      return NextResponse.redirect(url);
    }

    // If vendor hits root, redirect to vendor portal
    if (isVendor && pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/vendor";
      return NextResponse.redirect(url);
    }

    // If non-client/non-vendor hits root, redirect to dashboard
    if (!isClient && !isVendor && pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // If user is authenticated and trying to access login pages, redirect appropriately
    if (pathname === "/login" || pathname === "/signup") {
      const url = request.nextUrl.clone();
      url.pathname = homeRoute;
      return NextResponse.redirect(url);
    }

    if (pathname === "/client-login") {
      const url = request.nextUrl.clone();
      url.pathname = homeRoute;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
