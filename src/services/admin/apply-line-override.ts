import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Apply a per-line waive/comp to a bid (Phase 1, Option A reconciliation).
//
// THIN WRAPPER over the apply_line_override() Postgres function. All of the
// money work — load the line, validate the comp, read the line's prior latest
// delta, reconcile confirmed_price INCREMENTALLY, append the immutable override
// row, and append the source-tagged audit event — happens inside that function,
// in ONE transaction, under a `SELECT ... FOR UPDATE` lock on the booking row.
// Doing it in the DB is what makes it atomic: concurrent comps (or a comp racing
// a manual price edit) serialize on the booking lock instead of each reading a
// stale confirmed_price and clobbering the other's write, and a partial failure
// can no longer leave a visible override the total doesn't reflect.
//
// Reconciliation is INCREMENTAL: confirmed_price already reflects any prior
// manual edit AND any prior override, so the function adjusts it by only this
// application's *change* to the line's discount:
//
//   incremental = newDelta(this line) − priorLatestDelta(this line)
//   confirmed_price += incremental
//
// This composes manual edits and overrides without double-counting, and makes a
// reversing entry (new_amount = original_amount) restore the exact prior total.
// It NEVER mutates deposit_amount — when a comp pushes the total below the
// existing deposit the function returns depositExceedsTotal so the caller warns.
//
// Must be called with the service role (the RPC is GRANTed to service_role; the
// tables are service-role-write only). Authorization + status gating happen in
// the calling Server Action, before this runs.

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

// Shape returned by the apply_line_override() Postgres function (jsonb). The
// function owns every validation and money decision; we only marshal the call.
interface ApplyLineOverrideRpcResult {
  ok: boolean;
  error?: string;
  newConfirmedPrice?: number;
  depositExceedsTotal?: boolean;
}

export async function applyLineOverride(
  serviceClient: SupabaseClient,
  input: ApplyLineOverrideInput,
  actor: ApplyLineOverrideActor,
): Promise<ApplyLineOverrideResult> {
  const { data, error } = await serviceClient.rpc("apply_line_override", {
    p_booking_id: input.bookingId,
    p_line_item_id: input.lineItemId,
    p_new_amount: input.newAmount,
    p_reason: input.reason,
    p_customer_facing_label: input.customerFacingLabel,
    p_actor_id: actor.id,
    p_actor_email: actor.email,
  });

  if (error) {
    return { ok: false, error: `Couldn't apply the comp: ${error.message}` };
  }

  // The function returns a single jsonb object: { ok, error?, newConfirmedPrice?,
  // depositExceedsTotal? }. A business-rule rejection (e.g. comp exceeds the
  // line, total below $0) comes back as { ok: false, error } — not a thrown
  // Postgres error — so the caller surfaces a clean message.
  const result = (data ?? null) as ApplyLineOverrideRpcResult | null;
  if (!result) {
    return { ok: false, error: "The comp could not be applied." };
  }
  if (!result.ok) {
    return { ok: false, error: result.error ?? "The comp could not be applied." };
  }
  return {
    ok: true,
    newConfirmedPrice: result.newConfirmedPrice,
    depositExceedsTotal: result.depositExceedsTotal,
  };
}
