import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const moneyField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((moneyInput) => {
    if (moneyInput === null || moneyInput === undefined || moneyInput === "")
      return null;
    const parsed = parseFloat(moneyInput);
    return Number.isFinite(parsed) ? parsed : null;
  })
  .refine((amount) => amount === null || amount >= 0, "Must be ≥ 0");

export const UpdateBidPricingInputSchema = z.object({
  bidId: z.string().uuid(),
  bookingId: z.string().uuid(),
  confirmedPrice: moneyField,
  depositAmount: moneyField,
  quoteNote: z.string().trim().max(500).optional().nullable(),
});

export type UpdateBidPricingInput = z.infer<typeof UpdateBidPricingInputSchema>;
export type UpdateBidPricingRawInput = z.input<
  typeof UpdateBidPricingInputSchema
>;

export interface UpdateBidPricingResult {
  ok: boolean;
  error?: string;
}

// Persists the staff-set price for a bid: the confirmed quote + deposit
// (on the booking) and the optional quote note (on the bid). Read-only
// money — amount paid, refunds — is owned by the Stripe webhook path, not
// this admin edit.
export async function updateBidPricing(
  supabase: SupabaseClient,
  input: UpdateBidPricingInput,
): Promise<UpdateBidPricingResult> {
  const bookingUpdate = await supabase
    .from("bookings")
    .update({
      confirmed_price: input.confirmedPrice,
      deposit_amount: input.depositAmount,
    })
    .eq("id", input.bookingId);

  if (bookingUpdate.error) {
    return {
      ok: false,
      error: `Couldn't save pricing: ${bookingUpdate.error.message}`,
    };
  }

  const bidUpdate = await supabase
    .from("bids")
    .update({ quote_note: input.quoteNote ?? null })
    .eq("id", input.bidId);

  if (bidUpdate.error) {
    return {
      ok: false,
      error: `Couldn't save quote note: ${bidUpdate.error.message}`,
    };
  }

  return { ok: true };
}
