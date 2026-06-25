import type { SupabaseClient } from "@supabase/supabase-js";

// Soft-delete / restore a booking together with its bid. Both call
// is_admin()-gated SECURITY DEFINER RPCs that flip the booking + bid pair
// atomically (admin_soft_delete_booking / admin_restore_booking, see
// 20260625120000_soft_delete_bids_bookings.sql), so this service is a thin,
// typed adapter: pass the caller's Supabase client (its JWT carries the role
// the RPC checks) and surface a clean ok/error result.

export interface SoftDeleteResult {
  ok: boolean;
  error?: string;
}

export async function softDeleteBooking(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<SoftDeleteResult> {
  if (!bookingId) return { ok: false, error: "Missing booking id." };

  const { error } = await supabase.rpc("admin_soft_delete_booking", {
    p_booking_id: bookingId,
  });
  if (error) {
    return { ok: false, error: deleteErrorMessage(error.message) };
  }
  return { ok: true };
}

export async function restoreBooking(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<SoftDeleteResult> {
  if (!bookingId) return { ok: false, error: "Missing booking id." };

  const { error } = await supabase.rpc("admin_restore_booking", {
    p_booking_id: bookingId,
  });
  if (error) {
    return { ok: false, error: restoreErrorMessage(error.message) };
  }
  return { ok: true };
}

// Restore re-arms the capacity + travel-buffer triggers. If the slot was taken
// while the booking was deleted, the trigger raises and the restore rolls back
// — translate those into language an admin can act on.
function restoreErrorMessage(raw: string): string {
  if (/at capacity/i.test(raw)) {
    return "Can't restore — that time slot is now full. Free up the window or pick a new time first.";
  }
  if (/travel time/i.test(raw)) {
    return "Can't restore — the instructor now has a conflicting booking at another property in that window.";
  }
  if (/not authorized/i.test(raw)) {
    return "You don't have permission to restore this.";
  }
  return "Couldn't restore. Please try again.";
}

function deleteErrorMessage(raw: string): string {
  if (/not authorized/i.test(raw)) {
    return "You don't have permission to delete this.";
  }
  return "Couldn't delete. Please try again.";
}
