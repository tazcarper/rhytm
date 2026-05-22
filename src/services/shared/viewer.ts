import type { SupabaseClient } from "@supabase/supabase-js";

// What the TopBar (and any other site-wide chrome) needs to know about
// whoever's looking at the page right now. Intentionally tiny: a name to
// greet, an email to fall back on, and the role claim used to decide
// whether to surface admin/portal shortcuts. Other surfaces that need
// richer identity data should make their own scoped query.
export interface Viewer {
  email: string;
  displayName: string;
  role: string | null;
}

// Resolves the current viewer from a server-side Supabase client.
// Returns null for anonymous visitors. The `people: self read` policy
// only fires for members, so for partner / staff / no-role accounts
// the people lookup will come back empty and we fall back to the
// email local-part. That's intentional — the TopBar is decorative,
// not authoritative.
export async function getCurrentViewer(
  supabase: SupabaseClient,
): Promise<Viewer | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data: person } = await supabase
    .from("people")
    .select("first_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const firstName = person?.first_name?.trim() || null;
  const fallback = user.email.split("@")[0] ?? user.email;
  const roleClaim = user.app_metadata?.role;
  const role = typeof roleClaim === "string" ? roleClaim : null;

  return {
    email: user.email,
    displayName: firstName ?? fallback,
    role,
  };
}
