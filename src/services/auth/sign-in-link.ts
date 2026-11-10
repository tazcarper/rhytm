// A sign-in link that goes straight to our /auth/callback with the token
// in the query string, where the server can read it. Supabase's own
// action_link goes through its /verify page, which hands the session back
// in the URL #fragment (never sent to the server), so the callback saw
// "no token in URL". It also falls back to the project's Site URL when
// the preview address isn't on Supabase's redirect list. This avoids both.
export function callbackSignInLink(origin: string, hashedToken: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", "magiclink");
  return url.toString();
}
