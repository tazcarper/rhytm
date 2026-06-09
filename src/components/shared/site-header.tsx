import Link from "next/link";
import { headers } from "next/headers";
import { signOut } from "@/lib/auth/actions";
import { hasAdminAccess } from "@/lib/auth/portal";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentViewer } from "@/src/services/shared/viewer";
import { StickyHeader } from "./sticky-header";
import s from "./site-header.module.css";

// Suppress the global header on portal surfaces that ship their own
// chrome. /admin renders <AdminNav>, /instructor renders <InstructorNav>,
// and /dev has its own tooling header — a second bar there would double up.
const SUPPRESSED_PREFIXES = ["/admin", "/instructor", "/dev"] as const;

function shouldSuppress(pathname: string): boolean {
  return SUPPRESSED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// The one global header. Rendered once from the root layout so a single
// bar shows on every page that doesn't supply its own chrome. The brand
// wordmark sits top-left (always visible); auth affordances sit right —
// "Hello, <first name>" + Sign out when signed in, a "Sign in" link
// otherwise. Admins also get a link into /admin.
export async function SiteHeader() {
  const pathname = (await headers()).get("x-pathname") ?? "/";
  if (shouldSuppress(pathname)) return null;

  const supabase = await createServerSupabaseClient();
  const viewer = await getCurrentViewer(supabase);
  const onLoginPage = pathname === "/login";
  const showAdminLink = viewer !== null && hasAdminAccess(viewer.role);

  return (
    <StickyHeader>
      <header className={s.bar}>
        <div className={s.inner}>
          <Link
            href="/"
            className={s.brand}
            aria-label="Rhythm Outdoors — home"
          >
            <span className={s.eyebrow}>Rhythm</span>
            <span className={s.wordmark}>Outdoors</span>
          </Link>

          <div className={s.right}>
            {showAdminLink && (
              <>
                <Link href="/admin" className={s.adminLink}>
                  Admin
                </Link>
                <span className={s.divider} aria-hidden="true" />
              </>
            )}
            {viewer ? (
              <>
                {viewer.role === "member" ? (
                  <Link href="/member/profile" className={s.greeting}>
                    Hello, <strong>{viewer.displayName}</strong>
                  </Link>
                ) : (
                  <p className={s.greeting}>
                    Hello, <strong>{viewer.displayName}</strong>
                  </p>
                )}
                <span className={s.divider} aria-hidden="true" />
                <form action={signOut} className={s.signOutForm}>
                  <button type="submit" className={s.signOutBtn}>
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              !onLoginPage && (
                <Link href="/login" className={s.signInLink}>
                  Sign in
                </Link>
              )
            )}
          </div>
        </div>
      </header>
    </StickyHeader>
  );
}
