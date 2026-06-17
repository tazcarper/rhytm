import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordPricingEvent } from "./pricing-events";

// Apply a per-line waive/comp to a bid (Phase 1, Option A reconciliation).
//
// The service writes an append-only bid_line_overrides row, re-derives the
// booking's confirmed_price so every existing reader charges/shows the
// discounted total with zero changes, and appends a source-tagged audit event.
// It NEVER mutates deposit_amount — when a comp pushes the total below the
// existing deposit it returns depositExceedsTotal so the caller can warn.
//
// Reconciliation is INCREMENTAL, not recompute-from-scratch. confirmed_price
// already reflects any prior manual edit AND any prior override, so we adjust
// it by only this application's *change* to the line's discount:
//
//   incremental = newDelta(this line) − priorLatestDelta(this line)
//   confirmed_price += incremental
//
// This composes manual edits and overrides without double-counting, and makes
// a reversing entry (new_amount = original_amount) restore the exact prior
// total. A line's original_amount is always its bid_line_items.line_amount —
// the line row is never mutated, so that is the authoritative original quote.
//
// Requires the service role (bid_line_overrides / bid_pricing_events are
// service-role-write only; confirmed_price is admin-write). Authorization +
// status gating happen in the calling Server Action, before this runs.

export const ApplyLineOverrideInputSchema = z.object({
  bookingId: z.string().uuid(),
  lineItemId: z.string().uuid(),
  // Dollars. 0 = full waive. Must be <= the line's original amount (comps only
  // lower); equal to the original = a reversing entry.
  newAmount: z.number().nonnegative(),
  reason: z.string().trim().min(10, "Reason must be at least 10 characters"),
  customerFacingLabel: z
    .string()
    .trim()
    .max(60)
    .optional()
    .nullable()
    .transform((label) => (label ? label : null)),
});

export type ApplyLineOverrideInput = z.infer<typeof ApplyLineOverrideInputSchema>;
export type ApplyLineOverrideRawInput = z.input<
  typeof ApplyLineOverrideInputSchema
>;

export interface ApplyLineOverrideActor {
  id: string;
  email: string;
}

export interface ApplyLineOverrideResult {
  ok: boolean;
  error?: string;
  newConfirmedPrice?: number;
  // True when the (untouched) deposit now exceeds the discounted total — the
  // UI prompts the admin to lower the deposit via the PricingEditor.
  depositExceedsTotal?: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

export async function applyLineOverride(
  serviceClient: SupabaseClient,
  input: ApplyLineOverrideInput,
  actor: ApplyLineOverrideActor,
): Promise<ApplyLineOverrideResult> {
  // ---- 1. Load the target line; it must belong to this bid's booking. ----
  const { data: line, error: lineError } = await serviceClient
    .from("bid_line_items")
    .select("id, booking_id, line_amount")
    .eq("id", input.lineItemId)
    .maybeSingle<{ id: string; booking_id: string; line_amount: string | number }>();
  if (lineError) {
    return { ok: false, error: `Couldn't load the line: ${lineError.message}` };
  }
  if (!line || line.booking_id !== input.bookingId) {
    return { ok: false, error: "That line item is not part of this bid." };
  }
  const originalAmount = round2(toNumber(line.line_amount) ?? 0);

  // ---- 2. Validate: a comp only ever lowers (0 <= new <= original). ----
  if (input.newAmount > originalAmount + 0.005) {
    return {
      ok: false,
      error: `Comped amount can't exceed the line's $${originalAmount.toFixed(2)}.`,
    };
  }
  const newAmount = round2(input.newAmount);

  // ---- 3. Current effective total (already reflects prior manual + overrides). ----
  const { data: booking, error: bookingError } = await serviceClient
    .from("bookings")
    .select("id, estimated_price, confirmed_price, deposit_amount")
    .eq("id", input.bookingId)
    .maybeSingle<{
      id: string;
      estimated_price: string | number | null;
      confirmed_price: string | number | null;
      deposit_amount: string | number | null;
    }>();
  if (bookingError) {
    return { ok: false, error: `Couldn't load the bid: ${bookingError.message}` };
  }
  if (!booking) return { ok: false, error: "Bid not found." };

  const effectiveBefore =
    toNumber(booking.confirmed_price) ?? toNumber(booking.estimated_price);
  if (effectiveBefore === null) {
    return { ok: false, error: "This bid has no price to discount yet." };
  }

  // ---- 4. Incremental reconciliation (no double counting). ----
  const { data: priorRows } = await serviceClient
    .from("bid_line_overrides")
    .select("delta")
    .eq("line_item_id", input.lineItemId)
    .order("created_at", { ascending: false })
    .limit(1);
  const priorDelta =
    priorRows && priorRows[0] ? toNumber(priorRows[0].delta) ?? 0 : 0;
  const newDelta = round2(newAmount - originalAmount);
  const incremental = round2(newDelta - priorDelta);
  const newConfirmedPrice = round2(effectiveBefore + incremental);
  if (newConfirmedPrice < 0) {
    return { ok: false, error: "That comp would drive the total below $0." };
  }

  // ---- 5. Append the override row (immutable; actor stamped from session). ----
  const { data: inserted, error: insertError } = await serviceClient
    .from("bid_line_overrides")
    .insert({
      booking_id: input.bookingId,
      line_item_id: input.lineItemId,
      original_amount: originalAmount,
      new_amount: newAmount,
      reason: input.reason,
      customer_facing_label: input.customerFacingLabel,
      actor_id: actor.id,
      actor_email: actor.email,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !inserted) {
    return {
      ok: false,
      error: `Couldn't record the override: ${insertError?.message ?? "unknown error"}`,
    };
  }

  // ---- 6. Reconcile the booking total. ----
  const { error: updateError } = await serviceClient
    .from("bookings")
    .update({ confirmed_price: newConfirmedPrice })
    .eq("id", input.bookingId);
  if (updateError) {
    return { ok: false, error: `Couldn't update the total: ${updateError.message}` };
  }

  // ---- 7. Audit (source-tagged). ----
  await recordPricingEvent(serviceClient, {
    bookingId: input.bookingId,
    source: "line_override",
    lineOverrideId: inserted.id,
    oldTotal: round2(effectiveBefore),
    newTotal: newConfirmedPrice,
    actorId: actor.id,
    actorEmail: actor.email,
  });

  // ---- 8. Deposit invariant is an explicit admin responsibility (warn only). ----
  const deposit = toNumber(booking.deposit_amount);
  const depositExceedsTotal =
    deposit !== null && deposit > newConfirmedPrice + 0.005;

  return { ok: true, newConfirmedPrice, depositExceedsTotal };
}
