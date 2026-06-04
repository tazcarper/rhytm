import { createElement } from "react";
import { after } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
} from "@/src/services/notifications/send-email";
import { AdventureRsvpReceipt } from "@/src/components/email/templates/adventure-rsvp-receipt";
import { formatDateRange, formatMoney } from "@/src/services/public/format";
import { adventureTotal } from "@/src/services/adventures/display";

// Webhook handler for payment_intent.succeeded on an ADVENTURE RSVP
// (metadata.kind === 'adventure_rsvp'). Flips the held RSVP
// pending_payment → confirmed and stamps amount_paid / paid_at, then
// sends a branded receipt (best-effort, post-response). The route handler
// owns signature verification + the processed_webhooks claim before
// calling here. Service-role client (bypasses RLS); the capacity trigger
// already counted the pending hold, so confirming doesn't change capacity.

export interface HandleAdventureRsvpSucceededContext {
  supabase: SupabaseClient;
  event: Stripe.Event;
}

export async function handleAdventureRsvpSucceeded(
  ctx: HandleAdventureRsvpSucceededContext,
): Promise<void> {
  const { supabase, event } = ctx;
  const pi = event.data.object as Stripe.PaymentIntent;
  const rsvpId = pi.metadata?.rsvp_id;

  if (!rsvpId) {
    console.warn("[stripe webhook] adventure_rsvp PI missing rsvp_id", {
      piId: pi.id,
      eventId: event.id,
    });
    return;
  }

  // Confirm the held RSVP. WHERE status='pending_payment' guards replays
  // (already confirmed) and the rare cancelled-by-sweep race.
  const { data: updated, error } = await supabase
    .from("member_adventure_rsvps")
    .update({
      status: "confirmed",
      amount_paid: pi.amount / 100,
      paid_at: new Date().toISOString(),
    })
    .eq("id", rsvpId)
    .eq("status", "pending_payment")
    .select("id, guest_count, adventure_id, created_by_person_id")
    .maybeSingle();

  if (error) {
    // Hard DB failure — let the route return 500. The processed_webhooks
    // claim is already in place, so Stripe's retry short-circuits; surface
    // in Sentry (App 10).
    throw new Error(`[stripe webhook] adventure rsvp confirm failed: ${error.message}`);
  }

  if (!updated) {
    console.warn(
      "[stripe webhook] adventure_rsvp succeeded but RSVP not pending (replay/cancelled)",
      { rsvpId, piId: pi.id, eventId: event.id },
    );
    return;
  }

  // Receipt — best-effort, post-response.
  after(async () => {
    try {
      const [{ data: adventure }, personResult] = await Promise.all([
        supabase
          .from("member_adventures")
          .select("title, start_date, end_date, price, guest_price, properties ( name )")
          .eq("id", updated.adventure_id)
          .single(),
        updated.created_by_person_id
          ? supabase
              .from("people")
              .select("email, first_name")
              .eq("id", updated.created_by_person_id)
              .single()
          : Promise.resolve({ data: null as { email: string; first_name: string | null } | null }),
      ]);

      const person = personResult.data;
      if (!adventure || !person?.email) {
        console.warn("[stripe webhook] adventure receipt data missing", { rsvpId });
        return;
      }
      const property = Array.isArray(adventure.properties)
        ? adventure.properties[0]
        : adventure.properties;

      const toNum = (v: string | number | null): number =>
        v === null ? 0 : typeof v === "string" ? parseFloat(v) : v;
      const amountPaid = pi.amount / 100;
      const total = adventureTotal(toNum(adventure.price), toNum(adventure.guest_price), updated.guest_count);
      const balanceDue = Math.max(0, total - amountPaid);

      const props = {
        guestName: person.first_name ?? "Member",
        adventureTitle: adventure.title,
        propertyName: property?.name ?? "Rhythm Outdoors",
        dateLabel: formatDateRange(adventure.start_date, adventure.end_date),
        amountPaid: formatMoney(amountPaid),
        balanceDue: balanceDue > 0 ? formatMoney(balanceDue) : "0",
        guestCount: updated.guest_count,
      };

      const result = await getEmailService().send({
        to: person.email,
        from: DEFAULT_FROM_EMAIL,
        subject: `You're going — ${adventure.title}`,
        template: {
          name: "adventure_rsvp_receipt",
          element: createElement(AdventureRsvpReceipt, props),
          props,
        },
        source: "stripe_webhook",
        idempotencyKey: `payment_intent:${pi.id}`,
      });
      if (!result.ok) {
        console.error("[stripe webhook] adventure receipt send failed", {
          rsvpId,
          error: result.error,
        });
      }
    } catch (err) {
      console.error("[stripe webhook] adventure receipt threw", { rsvpId, err });
    }
  });
}
