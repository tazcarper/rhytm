import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rematerializeAddOnLines } from "@/src/services/bids/bid-line-items";
import type { StaffActor } from "@/src/services/admin/staff-identity";

// Mutations against booking_add_ons line items for a single bid's booking.
//
// IMPORTANT: booking_add_ons has SELECT-only RLS policies — there is no
// user-scoped write policy — so callers MUST pass a service-role client
// (lib/supabase/service). The calling Server Action is responsible for
// authorizing the admin and gating on bid status BEFORE invoking these.
//
// Integrity is enforced at the database layer:
//   - FK fk_valid_service_add_on → (service_id, add_on_id) must be a real
//     service_add_ons catalog link.
//   - Deferred trigger booking_add_ons_check_discipline() → service_id must
//     be one of the booking's selected disciplines.
// We map those violations to friendly messages rather than re-checking here.

export const AddBidAddOnInputSchema = z.object({
  bookingId: z.string().uuid(),
  serviceId: z.string().uuid(),
  addOnId: z.string().uuid(),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(99, "Quantity is too large"),
});
export type AddBidAddOnInput = z.infer<typeof AddBidAddOnInputSchema>;
export type AddBidAddOnRawInput = z.input<typeof AddBidAddOnInputSchema>;

export const RemoveBidAddOnInputSchema = z.object({
  bookingId: z.string().uuid(),
  bookingAddOnId: z.string().uuid(),
});
export type RemoveBidAddOnInput = z.infer<typeof RemoveBidAddOnInputSchema>;
export type RemoveBidAddOnRawInput = z.input<typeof RemoveBidAddOnInputSchema>;

export interface BidAddOnMutationResult {
  ok: boolean;
  error?: string;
}

// Rebuild the add-on portion of the bid's quote breakdown after the add-on set
// changed. Leaves the base/guest-fee snapshot intact. Best-effort: the add-on
// mutation already committed, so a rebuild failure must not fail the admin
// action — the lines self-correct on the next edit or backfill. No-ops when the
// bid is past the add-on edit window (rematerializeAddOnLines gates on status).
async function rebuildLineItems(
  supabase: SupabaseClient,
  bookingId: string,
  actor: StaffActor,
): Promise<void> {
  try {
    await rematerializeAddOnLines(supabase, bookingId, actor);
  } catch (lineErr) {
    console.error(
      "[admin/update-bid-add-ons] line-item rebuild failed",
      { bookingId, lineErr },
    );
  }
}

export async function addBidAddOn(
  supabase: SupabaseClient,
  input: AddBidAddOnInput,
  actor: StaffActor,
): Promise<BidAddOnMutationResult> {
  // Snapshot the live catalog price — never trust a client-supplied amount.
  const { data: addOn, error: addOnError } = await supabase
    .from("add_ons")
    .select("price, is_active")
    .eq("id", input.addOnId)
    .maybeSingle<{ price: string | number; is_active: boolean }>();

  if (addOnError) {
    return { ok: false, error: `Couldn't load the add-on: ${addOnError.message}` };
  }
  if (!addOn) {
    return { ok: false, error: "That add-on no longer exists." };
  }
  if (!addOn.is_active) {
    return { ok: false, error: "That add-on is inactive and can't be added." };
  }

  const unitPrice =
    typeof addOn.price === "string" ? parseFloat(addOn.price) : addOn.price;

  const { error } = await supabase.from("booking_add_ons").insert({
    booking_id: input.bookingId,
    service_id: input.serviceId,
    add_on_id: input.addOnId,
    quantity: input.quantity,
    unit_price_at_booking: unitPrice,
  });

  if (error) {
    // 23503 FK, 23514 check — both mean the add-on/service pairing isn't
    // valid for this booking's disciplines.
    if (error.code === "23503" || error.code === "23514") {
      return {
        ok: false,
        error: "That add-on isn't available for this booking's disciplines.",
      };
    }
    return { ok: false, error: `Couldn't add the add-on: ${error.message}` };
  }

  await rebuildLineItems(supabase, input.bookingId, actor);
  return { ok: true };
}

export async function removeBidAddOn(
  supabase: SupabaseClient,
  input: RemoveBidAddOnInput,
  actor: StaffActor,
): Promise<BidAddOnMutationResult> {
  // Scope the delete to the booking so an id alone can't touch another bid.
  const { error } = await supabase
    .from("booking_add_ons")
    .delete()
    .eq("id", input.bookingAddOnId)
    .eq("booking_id", input.bookingId);

  if (error) {
    return { ok: false, error: `Couldn't remove the add-on: ${error.message}` };
  }

  await rebuildLineItems(supabase, input.bookingId, actor);
  return { ok: true };
}
