import { createServiceRoleClient } from "@/lib/supabase/service";

// Postgres-backed sliding-window rate limit. FAILS OPEN: if the RPC errors
// (migration not applied yet, transient DB issue) the request is allowed —
// abuse protection must never take down a legitimate booking or signature.
//
// Returns true when the request is allowed, false when it's over the limit.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] rpc error", { key, message: error.message });
      return true; // fail open
    }
    return data !== false;
  } catch (err) {
    console.error("[rate-limit] threw", { key, err });
    return true; // fail open
  }
}

// Best-effort client IP from the X-Forwarded-For header (Vercel supplies a
// clean client IP as the first entry). Null when absent/implausible.
export function clientIpFrom(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const candidate = forwardedFor.split(",")[0]?.trim() ?? "";
  return candidate.length > 0 && candidate.length <= 45 ? candidate : null;
}
