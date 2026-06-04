import { createElement } from "react";
import { after } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest/client";
import { adventureSpotOpened } from "@/lib/inngest/events";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
} from "@/src/services/notifications/send-email";
import { AdventureCancellation } from "@/src/components/email/templates/adventure-cancellation";
import { formatMoney } from "@/src/services/public/format";

// Cancel an adventure RSVP and apply the refund policy:
//   windowed — full refund if cancelled >= free_cancellation_days before
//              the start; inside the window, forfeited (member self-cancel)
//   full     — refund everything paid (admin / club-side cancel)
//   none     — cancel, no refund (admin, or an unpaid lead)
// Always frees the slot (status -> cancelled fires the capacity sync
// trigger). Refund is idempotent (Stripe idempotency key + refunded_at
// guard). Receives an injected service-role client (members have no RSVP
// UPDATE policy) + Stripe.

export type RefundPolicy = "windowed" | "full" | "none";

export interface CancelAdventureRsvpResult {
  ok: boolean;
  reason?: "not_found" | "stripe_error" | "db_error";
  refunded: boolean;
  refundAmount: number;
  forfeited: boolean;
}

function toNum(value: string | number | null): number {
  if (value === null) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((start - today) / 86_400_000);
}

interface RsvpRow {
  id: string;
  status: string;
  adventure_id: string;
  amount_paid: string | number | null;
  deposit_payment_intent_id: string | null;
  refunded_at: string | null;
  created_by_person_id: string | null;
  member_adventures:
    | { title: string; start_date: string; free_cancellation_days: number }
    | { title: string; start_date: string; free_cancellation_days: number }[]
    | null;
}

export async function cancelAdventureRsvp(
  admin: SupabaseClient,
  stripe: Stripe,
  { rsvpId, refundPolicy }: { rsvpId: string; refundPolicy: RefundPolicy },
): Promise<CancelAdventureRsvpResult> {
  const { data, error } = await admin
    .from("member_adventure_rsvps")
    .select(
      "id, status, adventure_id, amount_paid, deposit_payment_intent_id, refunded_at, created_by_person_id, member_adventures ( title, start_date, free_cancellation_days )",
    )
    .eq("id", rsvpId)
    .single<RsvpRow>();

  if (error || !data) {
    return { ok: false, reason: "not_found", refunded: false, refundAmount: 0, forfeited: false };
  }
  // Idempotent: already cancelled → no-op success.
  if (data.status === "cancelled") {
    return { ok: true, refunded: false, refundAmount: 0, forfeited: false };
  }

  const adventure = Array.isArray(data.member_adventures)
    ? data.member_adventures[0]
    : data.member_adventures;
  const amountPaid = toNum(data.amount_paid);
  const window = adventure?.free_cancellation_days ?? 14;
  const insideWindow = adventure ? daysUntil(adventure.start_date) < window : true;

  let refundCents = 0;
  if (refundPolicy === "full") {
    refundCents = Math.round(amountPaid * 100);
  } else if (refundPolicy === "windowed") {
    refundCents = insideWindow ? 0 : Math.round(amountPaid * 100);
  }

  let refundedAmount = 0;
  if (refundCents > 0 && data.deposit_payment_intent_id && !data.refunded_at) {
    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: data.deposit_payment_intent_id,
          amount: refundCents,
          metadata: { rsvp_id: rsvpId },
        },
        { idempotencyKey: `adv-refund-${rsvpId}-v1` },
      );
      refundedAmount = refund.amount / 100;
    } catch (err) {
      console.error("[cancel-adventure-rsvp] Stripe refund failed", { rsvpId, err });
      return { ok: false, reason: "stripe_error", refunded: false, refundAmount: 0, forfeited: false };
    }
  }

  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = { status: "cancelled", cancelled_at: nowIso };
  if (refundedAmount > 0) {
    update.refunded_at = nowIso;
    update.refund_amount = refundedAmount;
  }
  const { error: upErr } = await admin
    .from("member_adventure_rsvps")
    .update(update)
    .eq("id", rsvpId)
    .neq("status", "cancelled");
  if (upErr) {
    return { ok: false, reason: "db_error", refunded: false, refundAmount: 0, forfeited: false };
  }

  const forfeited = amountPaid > 0 && refundedAmount === 0;

  // A confirmed/pending seat was freed → ping the waitlist to claim it.
  const freedSeat = data.status === "confirmed" || data.status === "pending_payment";
  if (freedSeat) {
    after(async () => {
      try {
        await inngest.send({
          id: `adv-spot-${rsvpId}`,
          name: adventureSpotOpened.name,
          data: { adventureId: data.adventure_id },
        });
      } catch (err) {
        console.error("[cancel-adventure-rsvp] spot-opened send failed", { rsvpId, err });
      }
    });
  }

  // Best-effort cancellation email.
  after(async () => {
    try {
      if (!data.created_by_person_id || !adventure) return;
      const { data: person } = await admin
        .from("people")
        .select("email, first_name")
        .eq("id", data.created_by_person_id)
        .single();
      if (!person?.email) return;
      const props = {
        guestName: person.first_name ?? "Member",
        adventureTitle: adventure.title,
        refunded: refundedAmount > 0,
        refundAmount: formatMoney(refundedAmount),
        forfeited,
      };
      await getEmailService().send({
        to: person.email,
        from: DEFAULT_FROM_EMAIL,
        subject: `Reservation cancelled — ${adventure.title}`,
        source: "adventure_cancellation",
        idempotencyKey: `adv-cancel-${rsvpId}`,
        template: {
          name: "adventure_cancellation",
          element: createElement(AdventureCancellation, props),
          props,
        },
      });
    } catch (err) {
      console.error("[cancel-adventure-rsvp] cancellation email threw", { rsvpId, err });
    }
  });

  return { ok: true, refunded: refundedAmount > 0, refundAmount: refundedAmount, forfeited };
}
