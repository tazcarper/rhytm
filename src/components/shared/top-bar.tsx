import Link from "next/link";
import { headers } from "next/headers";
import { signOut } from "@/lib/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentViewer } from "@/src/services/shared/viewer";
import s from "./top-bar.module.css";

// Suppress the site-wide bar on portal surfaces that ship their own
// chrome / identity strip. Admin and dev have their own headers; on
// /login the "Sign in" link would just point back at itself.
const SUPPRESSED_PREFIXES = ["/admin", "/dev"] as const;

function shouldSuppress(pathname: string): boolean {
  return SUPPRESSED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Minimalist auth strip pinned to the top of every non-admin, non-dev
// page. Signed-out visitors see a "Sign in" link; signed-in visitors
// see "Hello, <first name>" alongside a Sign out form-button.
export async function TopBar() {
  const pathname = (await headers()).get("x-pathname") ?? "/";
  if (shouldSuppress(pathname)) return null;

  const supabase = await createServerSupabaseClient();
  const viewer = await getCurrentViewer(supabase);
  const onLoginPage = pathname === "/login";

  return (
    <div className={s.bar}>
      <div className={s.inner}>
        {viewer ? (
          <>
            <p className={s.greeting}>
              Hello, <strong>{viewer.displayName}</strong>
            </p>
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
  );
}
