import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adventureTotal } from "@/src/services/adventures/display";

// Hold-then-pay checkout for an adventure RSVP (Q14 = full payment).
//
// 1. Upsert the member's RSVP to `pending_payment` — the capacity trigger
//    holds the slot (or rejects if full) under its FOR UPDATE lock, so a
//    second member can't pay for the same last spot.
// 2. Open a Stripe PaymentIntent for the full trip total.
// 3. The webhook flips pending_payment → confirmed on success; a
//    scheduled sweep releases abandoned holds.
//
// Receives an injected service-role client (the upsert needs to UPDATE an
// RSVP — members have no UPDATE RLS policy) + Stripe. The Server Action
// proves the caller owns `membershipId`/`personId` before calling here;
// the capacity trigger still fires regardless of role, so capacity is
// enforced. Total is computed server-side from the adventure row.

const REUSABLE_PI_STATES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
]);

export interface StartAdventureCheckoutArgs {
  adventure: {
    id: string;
    title: string;
    price: number;
    guestPrice: number | null;
    maxGuestsPerRsvp: number;
    paymentMode: "instant" | "deposit" | "inquire";
    depositAmount: number | null;
  };
  membershipId: string;
  personId: string;
  guestCount: number;
}

// How long a pending_payment hold survives before the sweep releases it.
// Shared with lib/inngest/functions/release-stale-adventure-holds.ts so
// the member-facing countdown matches the actual release window.
export const ADVENTURE_HOLD_TTL_MINUTES = 30;

export type StartAdventureCheckoutResult =
  // clientSecret is null for a free ($0 / "Included") trip — the RSVP is
  // confirmed immediately, no Stripe step. holdExpiresAt is when the
  // pending_payment hold lapses (null for a free/confirmed RSVP).
  | {
      ok: true;
      clientSecret: string | null;
      rsvpId: string;
      total: number; // full trip total
      chargeAmount: number; // collected now (= total for instant, = deposit for deposit mode)
      balanceDue: number; // total − chargeAmount (settled with the concierge)
      holdExpiresAt: string | null;
    }
  | {
      ok: false;
      reason:
        | "already_confirmed"
        | "full"
        | "guest_cap"
        | "no_price"
        | "stripe_error"
        | "db_error";
      message: string;
    };

function classifyWriteError(message: string): StartAdventureCheckoutResult {
  if (/max_guests_per_rsvp/i.test(message)) {
    return { ok: false, reason: "guest_cap", message: "That's more guests than this experience allows." };
  }
  if (/sold-out by staff/i.test(message) || /at capacity/i.test(message)) {
    return { ok: false, reason: "full", message: "This experience just filled up." };
  }
  return { ok: false, reason: "db_error", message: "Couldn't start your reservation. Try again in a moment." };
}

export async function startAdventureCheckout(
  admin: SupabaseClient,
  stripe: Stripe,
  args: StartAdventureCheckoutArgs,
): Promise<StartAdventureCheckoutResult> {
  const { adventure, membershipId, personId, guestCount } = args;

  if (guestCount < 1 || guestCount > adventure.maxGuestsPerRsvp) {
    return { ok: false, reason: "guest_cap", message: "That's more guests than this experience allows." };
  }

  const total = adventureTotal(adventure.price, adventure.guestPrice, guestCount);
  if (total < 0) {
    return { ok: false, reason: "no_price", message: "This experience has no price set yet — contact the concierge." };
  }
  // Collect the full total, unless this is a deposit-mode adventure with a
  // deposit smaller than the total (then the balance settles offline).
  const { depositAmount } = adventure;
  const chargeAmount =
    adventure.paymentMode === "deposit" && depositAmount && depositAmount > 0 && depositAmount < total
      ? depositAmount
      : total;
  const balanceDue = Math.max(0, total - chargeAmount);

  // A $0 ("Included") trip confirms immediately — no Stripe, no hold.
  const isFree = chargeAmount === 0;
  const targetStatus = isFree ? "confirmed" : "pending_payment";
  const nowIso = new Date().toISOString();

  // Existing RSVP for this membership + adventure (UNIQUE pair).
  const { data: existing, error: exErr } = await admin
    .from("member_adventure_rsvps")
    .select("id, status, deposit_payment_intent_id")
    .eq("adventure_id", adventure.id)
    .eq("membership_id", membershipId)
    .maybeSingle();

  if (exErr) {
    return { ok: false, reason: "db_error", message: "Couldn't start your reservation. Try again in a moment." };
  }

  let rsvpId: string;
  let existingPiId: string | null = null;
  let createdFresh = false;
  // updated_at after the upsert — the hold's start; the sweep releases it
  // at updated_at + TTL, which is what the member-facing countdown shows.
  let holdUpdatedAt: string | null = null;

  if (existing) {
    if (existing.status === "confirmed") {
      return { ok: false, reason: "already_confirmed", message: "You're already going on this adventure." };
    }
    existingPiId = existing.deposit_payment_intent_id;
    // Re-activate (cancelled/waitlisted) or refresh party size → the
    // capacity trigger re-checks on this status/guest_count UPDATE.
    const { data: upRow, error: upErr } = await admin
      .from("member_adventure_rsvps")
      .update(
        isFree
          ? { status: targetStatus, guest_count: guestCount, created_by_person_id: personId, amount_paid: 0, paid_at: nowIso }
          : { status: targetStatus, guest_count: guestCount, created_by_person_id: personId },
      )
      .eq("id", existing.id)
      .select("updated_at")
      .single();
    if (upErr) return classifyWriteError(upErr.message);
    rsvpId = existing.id;
    holdUpdatedAt = upRow.updated_at;
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("member_adventure_rsvps")
      .insert({
        adventure_id: adventure.id,
        membership_id: membershipId,
        created_by_person_id: personId,
        guest_count: guestCount,
        status: targetStatus,
        ...(isFree ? { amount_paid: 0, paid_at: nowIso } : {}),
      })
      .select("id, updated_at")
      .single();
    if (insErr) return classifyWriteError(insErr.message);
    rsvpId = inserted.id;
    holdUpdatedAt = inserted.updated_at;
    createdFresh = true;
  }

  // Free trip — confirmed above, no Stripe, no hold.
  if (isFree) {
    return { ok: true, clientSecret: null, rsvpId, total, chargeAmount: 0, balanceDue: 0, holdExpiresAt: null };
  }

  const holdExpiresAt = holdUpdatedAt
    ? new Date(
        new Date(holdUpdatedAt).getTime() + ADVENTURE_HOLD_TTL_MINUTES * 60_000,
      ).toISOString()
    : null;

  const expectedCents = Math.round(chargeAmount * 100);

  // Reuse the held PI if it matches the current total + is still payable.
  if (existingPiId) {
    const existingPi = await stripe.paymentIntents.retrieve(existingPiId).catch(() => null);
    if (
      existingPi &&
      existingPi.amount === expectedCents &&
      REUSABLE_PI_STATES.has(existingPi.status) &&
      existingPi.client_secret
    ) {
      return { ok: true, clientSecret: existingPi.client_secret, rsvpId, total, chargeAmount, balanceDue, holdExpiresAt };
    }
  }

  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.create({
      amount: expectedCents,
      currency: "usd",
      metadata: {
        kind: "adventure_rsvp",
        rsvp_id: rsvpId,
        adventure_id: adventure.id,
        membership_id: membershipId,
      },
      description: `Rhythm Outdoors — ${adventure.title}`,
    });
  } catch (err) {
    console.error("[start-adventure-checkout] PI create failed", err);
    // Release a freshly-held spot so an abandoned setup doesn't block others.
    if (createdFresh) {
      await admin.from("member_adventure_rsvps").update({ status: "cancelled" }).eq("id", rsvpId);
    }
    return { ok: false, reason: "stripe_error", message: "Payment couldn't be set up. Try again in a moment." };
  }

  const { error: piWriteErr } = await admin
    .from("member_adventure_rsvps")
    .update({ deposit_payment_intent_id: pi.id })
    .eq("id", rsvpId);
  if (piWriteErr) {
    console.error("[start-adventure-checkout] PI id write failed", { rsvpId, piId: pi.id, piWriteErr });
    return { ok: false, reason: "db_error", message: "Payment couldn't be saved. Try again in a moment." };
  }

  if (!pi.client_secret) {
    return { ok: false, reason: "stripe_error", message: "Payment couldn't be set up. Try again in a moment." };
  }
  return { ok: true, clientSecret: pi.client_secret, rsvpId, total, chargeAmount, balanceDue, holdExpiresAt };
}
