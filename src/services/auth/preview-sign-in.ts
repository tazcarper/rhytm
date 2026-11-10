import type { SupabaseClient } from "@supabase/supabase-js";

// One-click sign-in for Vercel preview sites (Taz, 2026-11-10). Every
// preview has its own web address, and browsers keep logins per address,
// so each new preview used to need a fresh magic link. On preview sites
// only, the login page offers a button that signs in as the account
// named in PREVIEW_LOGIN_EMAIL (set in Vercel for Preview only). Previews
// use their own database, separate from the live site's.

// The account to sign in as, or null when this isn't a preview site or
// no account is set. Never true on production or local dev.
export function previewLoginEmail(
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (env.VERCEL_ENV !== "preview") return null;
  const email = env.PREVIEW_LOGIN_EMAIL?.trim().toLowerCase();
  return email ? email : null;
}

export type PreviewSignInResult = { ok: true } | { ok: false; error: string };

// Makes a one-time sign-in token for `email` with the secret-key client
// and spends it straight away on the cookie-aware client, which sets the
// login cookies. The same thing a magic link does, without the email.
export async function signInForPreview(
  email: string,
  {
    adminClient,
    userClient,
  }: { adminClient: SupabaseClient; userClient: SupabaseClient },
): Promise<PreviewSignInResult> {
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    return {
      ok: false,
      error: error?.message ?? "No account with that email on this preview.",
    };
  }
  const verified = await userClient.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (verified.error) return { ok: false, error: verified.error.message };
  return { ok: true };
}
