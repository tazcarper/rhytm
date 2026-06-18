import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordPricingEvent } from "./pricing-events";
import { toNumber } from "@/src/services/public/format";

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

// Who is saving the price — stamped onto the audit event. Resolved from the
// session in the calling Server Action.
export interface UpdateBidPricingActor {
  id: string;
  email: string;
}

// Persists the staff-set price for a bid: the confirmed quote + deposit
// (on the booking) and the optional quote note (on the bid). Read-only
// money — amount paid, refunds — is owned by the Stripe webhook path, not
// this admin edit.
//
// Also appends a source = 'manual' pricing-audit event whenever the effective
// total changes. This is the manual counterpart to the line-override event, so
// the admin Pricing-history timeline can tell the mechanisms apart (the manual
// path was previously unaudited).
//
// The audit table is service-role-write only, so the caller injects an
// `auditClient` (a service-role client) rather than this service reaching out
// and instantiating one — Dependency Inversion: a service receives its clients,
// it does not construct them (CLAUDE.md SOLID › D).
export async function updateBidPricing(
  supabase: SupabaseClient,
  input: UpdateBidPricingInput,
  actor: UpdateBidPricingActor,
  auditClient: SupabaseClient,
): Promise<UpdateBidPricingResult> {
  // Snapshot the effective total before the write, for the audit diff.
  const { data: before } = await supabase
    .from("bookings")
    .select("estimated_price, confirmed_price")
    .eq("id", input.bookingId)
    .maybeSingle<{
      estimated_price: string | number | null;
      confirmed_price: string | number | null;
    }>();
  const estimated = before ? toNumber(before.estimated_price) : null;
  const oldTotal = before
    ? toNumber(before.confirmed_price) ?? estimated
    : null;

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

  // Audit the change to the effective total. confirmed_price clearing to null
  // falls back to the estimate, so compare effective-to-effective. Only record
  // a real movement (> half a cent). The event table is service-role-write.
  const newTotal = input.confirmedPrice ?? estimated;
  if (
    oldTotal !== null &&
    newTotal !== null &&
    Math.abs(newTotal - oldTotal) > 0.005
  ) {
    await recordPricingEvent(auditClient, {
      bookingId: input.bookingId,
      source: "manual",
      oldTotal,
      newTotal,
      actorId: actor.id,
      actorEmail: actor.email,
      note: input.quoteNote ?? null,
    });
  }

  return { ok: true };
}
