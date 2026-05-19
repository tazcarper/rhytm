import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { portalHomeForRole } from "@/lib/auth/portal";

// Magic-link callback for Supabase Auth.
//
// Supabase Auth can deliver invite/magic-link emails in two URL shapes
// depending on which email template version is active in the project:
//   - PKCE / code flow:          `?code=…`
//   - OTP verification flow:     `?token_hash=…&type=invite`
// Newer projects default to the token_hash shape; older templates send
// `?code`. This handler accepts both so the route works regardless of
// the project's template version.
//
// People are seeded into `public.people` from the Excel roster with
// `user_id = null`. The Auth account does not exist yet. Inngest's
// `seed-member-invites` calls `inviteUserByEmail` once per unique email,
// which creates the Auth user (if new) and sends a single magic link.
// (After the people/memberships split, the magic link covers the
// person, not the membership — one auth user binds to one people row,
// which can be on N memberships via the junction.)
//
// After sign-in is established this handler:
//   1. Sets the auth cookies via the cookie-aware server client (the
//      verifyOtp / exchangeCodeForSession call handles this through the
//      @supabase/ssr cookie adapter).
//   2. On first sign-in (`app_metadata.role` is empty), looks up the
//      pending `people` row for this email (one row max, since email is
//      UNIQUE in people), sets `user_id` and `invite_accepted_at`, then
//      stamps `app_metadata.role = 'member'` so RLS and middleware
//      recognize them on subsequent requests.
//   3. If no pending row exists (never invited, already linked, or the
//      invite expired), signs the user out and redirects to
//      /invite-not-found. Required by Phase 4 — expired magic links
//      must not quietly succeed.
//
// Staff and partner accounts have `app_metadata` set manually by an
// admin before they ever click their invite, so they skip the linking
// branch and route straight to their portal.

// Possible failure stages. Surfaced via the `?stage=` param so the
// error page can show which step failed without us having to guess.
type CallbackStage =
  | "missing_token" // No code / token_hash in URL
  | "exchange_code" // exchangeCodeForSession failed (PKCE flow)
  | "verify_otp" //   verifyOtp failed (token-hash flow)
  | "get_user" //     getUser returned null after sign-in
  | "pending_query" // member-row lookup failed
  | "link_rows" //    UPDATE of members.user_id failed
  | "stamp_role" //   updateUserById app_metadata write failed
  | "refresh_jwt"; // refreshSession failed (JWT still has old role)

function errorRedirect(
  origin: string,
  stage: CallbackStage,
  reason?: string | null,
): NextResponse {
  const url = new URL("/auth/auth-code-error", origin);
  url.searchParams.set("stage", stage);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next") ?? null;

  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return errorRedirect(origin, "exchange_code", error.message);
    }
  } else if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    if (error) {
      return errorRedirect(origin, "verify_otp", error.message);
    }
  } else {
    return errorRedirect(origin, "missing_token");
  }

  // `getUser` re-validates the freshly-exchanged JWT against Supabase
  // Auth — never trust `getSession()` server-side, which only reads
  // the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorRedirect(origin, "get_user");
  }

  const role = user.app_metadata?.role as string | undefined;
  // Supabase Auth normalizes emails to lowercase, and the createTestMember
  // action also lowercases. Belt-and-braces: lowercase here too so any
  // upstream change to either side can't silently break the join.
  const normalizedEmail = user.email!.toLowerCase();

  if (!role) {
    // First-ever sign-in for an invited person. Find the pending
    // people row (at most one — email is UNIQUE in people), link it,
    // stamp the role.
    const admin = createServiceRoleClient();

    const { data: pending, error: pendingError } = await admin
      .from("people")
      .select("id")
      .eq("email", normalizedEmail)
      .is("user_id", null)
      .gt("invite_expires_at", new Date().toISOString())
      .maybeSingle();

    if (pendingError) {
      return errorRedirect(origin, "pending_query", pendingError.message);
    }

    if (!pending) {
      // Either no invite exists for this email, the invite has expired,
      // or this email's people row has already been linked to a
      // different Auth account. Sign the user out — leaving them
      // signed-in with no role would let them through public routes
      // and confuse the middleware on the next request.
      //
      // Redirect back to /login with an `?error=` flag so the page can
      // surface the failure as an inline alert above the form, instead
      // of a separate standalone error page.
      await supabase.auth.signOut();
      const url = new URL("/login", origin);
      url.searchParams.set("error", "invite-not-found");
      url.searchParams.set("email", normalizedEmail);
      return NextResponse.redirect(url);
    }

    const now = new Date().toISOString();

    const { error: linkError } = await admin
      .from("people")
      .update({
        user_id: user.id,
        invite_accepted_at: now,
      })
      .eq("id", pending.id)
      // Final guard against the same row being linked twice — RLS-bypass
      // client + concurrent clicks could otherwise race.
      .is("user_id", null);

    if (linkError) {
      return errorRedirect(origin, "link_rows", linkError.message);
    }

    const { error: stampError } = await admin.auth.admin.updateUserById(
      user.id,
      { app_metadata: { role: "member" } },
    );

    if (stampError) {
      return errorRedirect(origin, "stamp_role", stampError.message);
    }

    // `updateUserById` writes the new role to auth.users.app_metadata,
    // but the JWT in this user's cookies was issued moments ago by
    // verifyOtp / exchangeCodeForSession and still has no role claim.
    // RLS reads from the JWT (`auth.jwt() -> 'app_metadata' ->> 'role'`),
    // so the next page hit would see `role = null` and every
    // member-scoped policy would block the read — `/member` would
    // render an empty memberships list even though the rows are linked
    // correctly. The unconditional refresh at the bottom of this
    // handler picks up the stamped claim before any redirect.
  }

  // Always refresh before redirecting. Three reasons:
  //   (1) First-time-link branch above just stamped a fresh role into
  //       app_metadata via the admin API — the cookie JWT needs to be
  //       reissued to include it.
  //   (2) Google OAuth's returning-user branch: Supabase sometimes mints
  //       the post-OAuth JWT without the existing app_metadata claims
  //       included. Without a refresh, middleware reads cookies on the
  //       next request, sees no role, and bounces the user to
  //       /unauthorized even though `auth.users.app_metadata.role` is
  //       correct in the DB. This was the reported "Google sign-in
  //       lands on /unauthorized" symptom.
  //   (3) Cheap belt-and-braces for the magic-link returning-user path
  //       too — guarantees the JWT going downstream matches DB state.
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    return errorRedirect(origin, "refresh_jwt", refreshError.message);
  }

  // Re-read the user after refresh in case app_metadata changed during
  // the first-time-link branch (role was just stamped). For the
  // returning-user path, this is functionally a no-op but keeps the
  // post-refresh role authoritative.
  const {
    data: { user: refreshedUser },
  } = await supabase.auth.getUser();
  const finalRole = (refreshedUser?.app_metadata?.role as string | undefined) ?? role;

  return NextResponse.redirect(
    new URL(next ?? portalHomeForRole(finalRole), origin),
  );
}
