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
  // The effective confirmed_price the editor loaded, for optimistic-concurrency
  // compare-and-swap (null when the bid was priced by estimate only, so
  // confirmed_price is null in the DB). The editor passes a number/null directly
  // — not a money string — so this bypasses moneyField's string transform.
  expectedConfirmedPrice: z.number().nullable(),
});

export type UpdateBidPricingInput = z.infer<typeof UpdateBidPricingInputSchema>;
export type UpdateBidPricingRawInput = z.input<
  typeof UpdateBidPricingInputSchema
>;

export interface UpdateBidPricingResult {
  ok: boolean;
  error?: string;
  // True when the guarded update matched 0 rows because confirmed_price moved
  // since the editor loaded it (a comp or add-on auto-reversal landed in
  // between). The UI shows a distinct "reload" affordance — and preserves the
  // admin's drafts — instead of the generic error treatment.
  conflict?: boolean;
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
  // Compare-and-swap (optimistic concurrency): write only while confirmed_price
  // still equals the value the editor loaded. If a per-line comp or the add-on
  // auto-reversal changed it in the gap since load, the guard matches 0 rows and
  // we reject with a conflict — never clobbering that concurrent change with an
  // absolute headline that drops its delta. confirmed_price is numeric(10,2) and
  // every writer rounds to cents, so exact equality is safe (no float drift).
  const guardedUpdate = supabase
    .from("bookings")
    .update({
      confirmed_price: input.confirmedPrice,
      deposit_amount: input.depositAmount,
    })
    .eq("id", input.bookingId);
  const bookingUpdate = await (input.expectedConfirmedPrice === null
    ? guardedUpdate.is("confirmed_price", null)
    : guardedUpdate.eq("confirmed_price", input.expectedConfirmedPrice)
  ).select("estimated_price");

  if (bookingUpdate.error) {
    return {
      ok: false,
      error: `Couldn't save pricing: ${bookingUpdate.error.message}`,
    };
  }

  // 0 rows matched: confirmed_price moved since the editor loaded it. Reject
  // before touching the quote note, so the manual save can't half-apply.
  const updatedRows = bookingUpdate.data ?? [];
  if (updatedRows.length === 0) {
    return {
      ok: false,
      conflict: true,
      error:
        "This bid's price changed since you opened the editor — reload to see the latest before saving.",
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

  // Audit the change to the effective total. The guard above proves
  // confirmed_price equalled expectedConfirmedPrice at write time, so that — not
  // a separate, race-prone pre-read — is the accurate "from" figure. A null
  // confirmed_price (priced by estimate) falls back to the estimate on both
  // sides, so compare effective-to-effective. estimated_price is immutable after
  // creation; read it back from the row we just updated. Only record a real
  // movement (> half a cent). The event table is service-role-write.
  const estimated = toNumber(
    (updatedRows[0] as { estimated_price: string | number | null })
      .estimated_price,
  );
  const oldTotal = input.expectedConfirmedPrice ?? estimated;
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
