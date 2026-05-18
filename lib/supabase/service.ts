import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client. **Bypasses all RLS.** Server-side ONLY.
// Never import this from a client component or expose the key it uses.
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // No session persistence — service role doesn't represent a user.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
