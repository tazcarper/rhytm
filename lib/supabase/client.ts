import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Uses the publishable key
// (sb_publishable_…); all reads/writes are subject to RLS. Use this in
// client components ("use client").
//
// For Server Components, Route Handlers, and Server Actions, prefer
// `createServerSupabaseClient` from `./server` (cookie-aware) or
// `createServiceRoleClient` from `./service` (RLS-bypassing).
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
