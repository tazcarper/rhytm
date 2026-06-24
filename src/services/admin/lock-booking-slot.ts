import type { SupabaseClient } from "@supabase/supabase-js";

// The slot-lock action (plan §7). Commits a real slot onto a booking that
// arrived on a provisional, unenforced slot (a /request-estimate soft request
// at status pending_review) and advances it to awaiting_guest — in ONE update
// (via the lock_booking_slot RPC) so the §6 availability triggers fire and
// enforce no-double-book. Must run BEFORE/with confirm so a confirmed bid never
// sits on an unenforced slot.
//
// Service-role only: the RPC is granted to service_role and bypasses RLS, so the
// CALLER must verify admin access before invoking this (the admin action does).

export interface LockSlotInput {
  // YYYY-MM-DD; combined with slotStart at the property timezone inside the RPC.
  date: string;
  // HH:MM[:SS] wall-clock at the property.
  slotStart: string;
  durationHours: number;
}

export type LockSlotResult =
  | { ok: true; startTime: string; endTime: string }
  | { ok: false; reason: LockFailureReason; message: string };

export type LockFailureReason =
  | "slot_taken"
  | "invalid_start_time"
  | "invalid_combination"
  | "unknown";

export async function lockBookingSlot(
  supabase: SupabaseClient,
  bookingId: string,
  input: LockSlotInput,
): Promise<LockSlotResult> {
  const { data, error } = await supabase.rpc("lock_booking_slot", {
    p_booking_id: bookingId,
    p_date: input.date,
    p_slot_start: input.slotStart,
    p_duration_hours: input.durationHours,
  });

  if (error) return mapLockError(error);

  const row = (data as Array<{ start_time: string; end_time: string }> | null)?.[0];
  if (!row) {
    return {
      ok: false,
      reason: "unknown",
      message: "The slot didn't lock. Refresh and try again.",
    };
  }
  return { ok: true, startTime: row.start_time, endTime: row.end_time };
}

// Mirrors the trigger-error mapping in create-public-booking.ts so staff get
// "that slot's taken" instead of a raw Postgres error.
function mapLockError(error: { code?: string; message?: string }): LockSlotResult {
  const code = error.code;
  const message = error.message ?? "";

  // Instructor exclusion constraint (not expected for plan_a_visit, but mapped).
  if (code === "23P01") {
    return {
      ok: false,
      reason: "slot_taken",
      message: "That slot conflicts with another booking — pick another time.",
    };
  }

  if (code === "P0001") {
    if (/capacity|max_concurrent/i.test(message)) {
      return {
        ok: false,
        reason: "slot_taken",
        message: "That slot is already taken at capacity — pick another time.",
      };
    }
    if (/time_slot|start_time|valid booking slot/i.test(message)) {
      return {
        ok: false,
        reason: "invalid_start_time",
        message: "That start time isn't a valid slot for this property — pick a listed time.",
      };
    }
    return {
      ok: false,
      reason: "slot_taken",
      message: "That slot is no longer available — pick another time.",
    };
  }

  if (code === "23514") {
    return {
      ok: false,
      reason: "invalid_combination",
      message: "That duration isn't valid for this booking type.",
    };
  }

  return {
    ok: false,
    reason: "unknown",
    message: "We couldn't lock that slot. Please try again.",
  };
}
