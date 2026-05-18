import { createClient } from "@supabase/supabase-js";

// Secret-key Supabase client. **Bypasses all RLS.** Server-side ONLY.
// Never import this from a client component or expose the key it uses.
//
// The function is named `createServiceRoleClient` because Supabase still
// authenticates `sb_secret_…` keys as the Postgres `service_role` role
// under the hood — that's how RLS-bypass works. The user-facing key
// vocabulary is "secret"; the database-level role vocabulary is still
// "service_role." Both names are correct, depending on the layer.
//
// Use for:
//   - Public booking-flow writes (Server Action that creates booking + bid).
//   - Webhook handlers (Stripe, Dropbox Sign) that need to update bookings
//     regardless of caller identity.
//   - Public bid-page reads (the /bid/[slug] route fetches via service
//     role and column-projects to a customer-safe allowlist).
//   - Member-seeding scripts.
//
// Use the cookie-aware server client (`./server`) for any operation that
// should respect the signed-in user's RLS scope.
export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        // No session persistence — service role doesn't represent a user.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
