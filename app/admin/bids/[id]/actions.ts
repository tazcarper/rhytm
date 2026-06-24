"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { hasAdminAccess } from "@/lib/auth/portal";
import {
  confirmBid,
  denyBid,
  regenerateBidUrl,
  type RegenerateResult,
  type TransitionResult,
} from "@/src/services/admin/transition-bid";
import { lockBookingSlot } from "@/src/services/admin/lock-booking-slot";

function siteOriginFromHeaders(h: Headers): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function confirmBidAction(
  bidId: string,
): Promise<TransitionResult> {
  if (!bidId) return { ok: false, error: "Missing bid id." };

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const staffId = userData.user?.id;
  if (!staffId) return { ok: false, error: "Sign in required." };

  const result = await confirmBid(supabase, bidId, staffId);

  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
    revalidatePath("/admin/bids");
    revalidatePath("/admin");
  }
  return result;
}

// Lock the real slot, then confirm — the estimate path's confirm (plan §7).
// A quote-only estimate bid arrives on a provisional, unenforced slot
// (booking at pending_review). Confirming it directly would leave a confirmed
// bid on an unenforced slot, so we lock first: lock_booking_slot sets the real
// start_time/duration and advances bookings.status → awaiting_guest, which
// re-arms the availability triggers; only if that succeeds do we confirm the
// bid. One staff action, lock-before-confirm guaranteed.
export async function lockAndConfirmBidAction(
  bidId: string,
  bookingId: string,
  input: { date: string; slotStart: string; durationHours: number },
): Promise<TransitionResult> {
  if (!bidId || !bookingId) return { ok: false, error: "Missing bid or booking id." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: "Pick a valid date." };
  }
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(input.slotStart)) {
    return { ok: false, error: "Pick a valid start time." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const staffId = userData.user?.id;
  const role = userData.user?.app_metadata?.role as string | undefined;
  if (!staffId) return { ok: false, error: "Sign in required." };
  // The lock RPC runs via service-role (bypasses RLS), so gate on admin here.
  if (!hasAdminAccess(role)) return { ok: false, error: "Admin access required." };

  const lock = await lockBookingSlot(createServiceRoleClient(), bookingId, input);
  if (!lock.ok) return { ok: false, error: lock.message };

  // Slot is locked + enforced; confirm via the cookie client (admin RLS).
  const result = await confirmBid(supabase, bidId, staffId);
  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
    revalidatePath("/admin/bids");
    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
  }
  return result;
}

export async function denyBidAction(
  bidId: string,
  reason: string,
): Promise<TransitionResult> {
  if (!bidId) return { ok: false, error: "Missing bid id." };
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, error: "A denial reason is required." };
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: "Denial reason is too long (max 2000)." };
  }

  const supabase = await createServerSupabaseClient();
  const result = await denyBid(supabase, bidId, trimmed);

  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
    revalidatePath("/admin/bids");
    revalidatePath("/admin");
  }
  return result;
}

export async function regenerateBidUrlAction(
  bidId: string,
): Promise<RegenerateResult> {
  if (!bidId) return { ok: false, error: "Missing bid id." };

  const h = await headers();
  const origin = siteOriginFromHeaders(h);

  const supabase = await createServerSupabaseClient();
  const result = await regenerateBidUrl(supabase, bidId, origin);

  if (result.ok) {
    revalidatePath(`/admin/bids/${bidId}`);
  }
  return result;
}
