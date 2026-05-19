import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { portalHomeForRole } from "@/lib/auth/portal";
import { Divider, Eyebrow, Heading, PageShell } from "@/lib/ui";
import { CyclingProperty } from "./cycling-property";
import { LoginAlert } from "./login-alert";
import { LoginForm } from "./login-form";
import styles from "./login.module.css";

export const dynamic = "force-dynamic";

// Members' entrance. Magic-link only. The same /login route serves
// all three properties — members of Horseshoe Bay, Hog Heaven, and
// Packsaddle all start here. Per-property themed login pages are a
// future possibility but not in scope today.
//
// Partner sign-in (email + password) and admin sign-in (email +
// password + MFA) will land with App 5 and App 3 respectively. They
// are intentionally NOT on this page — each has a different auth
// shape and warrants its own surface.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; email?: string }>;
}) {
  const {
    next: rawNext,
    error: rawError,
    email: rawErrorEmail,
  } = await searchParams;

  // Open-redirect guard. Only same-origin relative paths are honored.
  // Anything else (full URLs, protocol-relative //evil.com, missing) is
  // dropped to null and the post-sign-in redirect falls back to the
  // role's default portal.
  const next =
    typeof rawNext === "string" &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//")
      ? rawNext
      : null;

  // Callback-emitted error to surface as an inline alert above the
  // form. Currently only `invite-not-found` is sent, but the shape is
  // open-ended — add new keys in app/login/login-alert.tsx as needed.
  const errorKey = typeof rawError === "string" ? rawError : null;
  const errorEmail = typeof rawErrorEmail === "string" ? rawErrorEmail : null;

  // Already signed in? Send them where they belong. Done server-side
  // so there's no flash of the form before the client-side redirect
  // would fire.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const role = user.app_metadata?.role as string | undefined;
    redirect(next ?? portalHomeForRole(role));
  }

  return (
    <PageShell dark dotGrid>
      <div className={styles.loginCard}>
        {errorKey && <LoginAlert errorKey={errorKey} email={errorEmail} />}
        <Eyebrow variant="crest" as="div" className={styles.loginCrest}>
          Members&rsquo; Entrance
        </Eyebrow>
        <Heading level={1} size="h2" className={styles.loginWordmark}>
          Rhythm
          <br />
          <em>Outdoors</em>
        </Heading>
        <p className={styles.loginTag}>A members&rsquo; entrance for</p>
        <CyclingProperty />
        <Divider variant="accent" className={styles.loginAccent} />
        <Eyebrow as="div" className={styles.loginEyebrow}>
          Identify yourself
        </Eyebrow>

        <LoginForm next={next} />

        <div className={styles.loginFoot}>
          Trouble signing in? Contact your property&rsquo;s membership
          coordinator to confirm your invitation, or have a fresh link
          sent.
        </div>
      </div>
    </PageShell>
  );
}
