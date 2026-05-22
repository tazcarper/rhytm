import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Roles allowed into each portal. Keys match the path prefix. RLS is
// the database-level gate; this is the application-level gate. Both
// must hold — defense in depth.
const PORTAL_ALLOWLIST: Record<string, ReadonlySet<string>> = {
  "/admin": new Set([
    "super_admin",
    "admin",
    "property_manager",
    "concierge",
    "membership_coordinator",
  ]),
  "/member": new Set(["member"]),
  "/partner": new Set(["partner"]),
};

function matchPortalPrefix(pathname: string): string | null {
  for (const prefix of Object.keys(PORTAL_ALLOWLIST)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return prefix;
    }
  }
  return null;
}

// Refreshes the Supabase auth session on every request and gates the
// per-portal route groups by JWT `app_metadata.role`. Public routes
// (/, /auth/*, /login, /unauthorized) pass through without a role
// check; the session refresh still runs so Server Components see the
// same cookies on the request and response.
//
// File convention: Next.js 16 renamed the `middleware` file to
// `proxy` (the prior `middleware.ts` is deprecated). The runtime
// expects either a default export or a function named `proxy`.
export async function proxy(request: NextRequest) {
  // Server Components have no native way to read the current pathname.
  // Forward it on the request so layouts/components can branch on route
  // (e.g. the site-wide TopBar suppresses itself under /admin and /dev).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const portal = matchPortalPrefix(request.nextUrl.pathname);
  if (portal) {
    if (!user) {
      // No session — bounce to /login with a ?next= back to where they
      // were headed. The login page will eventually accept email and
      // call signInWithOtp with emailRedirectTo=/auth/callback?next=…
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = user.app_metadata?.role as string | undefined;
    const allowed = PORTAL_ALLOWLIST[portal];
    if (!role || !allowed.has(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals, static files, and image optimization.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
