import "server-only";
import { createElement } from "react";
import { inngest } from "../client";
import { bidSigned } from "../events";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
  getSiteOrigin,
} from "@/src/services/notifications/send-email";
import {
  formatDateLongTz,
  formatMoney,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import { WaiverSigned } from "@/src/components/email/templates/waiver-signed";
import { getBidUrlForAdmin } from "@/src/services/bids/get-bid-url-for-admin";

// Subscribes to `bid/signed` and emails the guest the moment they sign
// their waiver on the bid page. Two copy branches keyed on whether the
// signature finalized the booking:
//
//   - FINALIZED ("You're all set"): the signature was the last thing we
//     needed — either a no-deposit bid, or a deposit bid already paid
//     (pay-then-sign). Terminal email, no CTA.
//   - NOT FINALIZED ("Waiver received, now pay"): a deposit bid whose
//     deposit is still owed (sign-then-pay). CTA points back to the bid
//     page to pay.
//
// `finalized = hasDeposit ? paidAt != null : true` — mirrors the same
// predicate emit-signed-side-effects.ts uses to decide whether to fire
// `booking/confirmed`. This handler deliberately does NOT subscribe to
// `booking/confirmed`: the sign-then-pay deposit path gets its terminal
// "we'll see you" message from the deposit-receipt email, so finalizing
// off the booking event would double-send. Keying off `bid/signed` lets
// the signing moment own its copy with no overlap.
//
// Step shape mirrors send-bid-confirmed-email.ts:
//   1. lookup-bid-details — single bids→bookings→properties join (+ bid
//      paid_at). Inngest caches the return so a retry of `send` doesn't
//      re-query.
//   2. resolve-bid-url — recover the plaintext access code and assemble
//      the absolute URL for the pay CTA. Null for legacy bids.
//   3. send — render + send. Throws on !ok so Inngest retries transient
//      transport failures independently from the lookup step.

type SignedLookupRow = {
  paid_at: string | null;
  bookings: {
    guest_name: string;
    guest_email: string;
    guest_count: number;
    start_time: string;
    estimated_price: string | null;
    confirmed_price: string | null;
    deposit_amount: string | null;
    properties: { name: string; timezone: string } | null;
  } | null;
};

export const sendWaiverSignedEmail = inngest.createFunction(
  {
    id: "send-waiver-signed-email",
    triggers: [bidSigned],
  },
  async ({ event, step }) => {
    const { bidId } = event.data;

    const details = await step.run("lookup-bid-details", async () => {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("bids")
        .select(
          "paid_at, bookings ( guest_name, guest_email, guest_count, start_time, estimated_price, confirmed_price, deposit_amount, properties ( name, timezone ) )",
        )
        .eq("id", bidId)
        .single<SignedLookupRow>();

      if (error || !data) {
        throw new Error(
          `lookup-bid-details failed for bid ${bidId}: ${
            error?.message ?? "no row"
          }`,
        );
      }
      const booking = data.bookings;
      if (!booking) {
        throw new Error(
          `lookup-bid-details: bid ${bidId} missing joined booking`,
        );
      }
      if (!booking.properties) {
        throw new Error(
          `lookup-bid-details: bid ${bidId} booking missing joined property`,
        );
      }

      // Numeric columns arrive as strings over PostgREST. Effective quote
      // is the admin's confirmed_price override, else the auto-estimate
      // (matches BidBooking.effectiveQuote + the bid-confirmed email).
      const totalPriceNum = Number(
        booking.confirmed_price ?? booking.estimated_price ?? 0,
      );
      const depositNum =
        booking.deposit_amount !== null
          ? Number(booking.deposit_amount)
          : null;

      return {
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        guestCount: booking.guest_count,
        startTime: booking.start_time,
        propertyName: booking.properties.name,
        propertyTimezone: booking.properties.timezone,
        totalPriceNum,
        depositNum,
        paidAt: data.paid_at,
      };
    });

    const hasDeposit =
      details.depositNum !== null && details.depositNum > 0;
    // Signing finalizes the booking unless a deposit is owed and unpaid.
    const finalized = hasDeposit ? details.paidAt !== null : true;

    const bidUrl = await step.run("resolve-bid-url", async () => {
      // Only the not-finalized branch renders a CTA; skip the lookup when
      // we won't use it.
      if (finalized) return null;
      const supabase = createServiceRoleClient();
      const result = await getBidUrlForAdmin(supabase, bidId, getSiteOrigin());
      return result.url;
    });

    const sendResult = await step.run("send", async () => {
      const dateLong = formatDateLongTz(
        details.startTime,
        details.propertyTimezone,
      );
      // Hardcoded " CT" matches the funnel UI + sibling emails; all
      // properties are America/Chicago today.
      const timeLabel = `${formatSlotLabelTz(
        details.startTime,
        details.propertyTimezone,
      )} CT`;

      const depositNum = details.depositNum ?? 0;
      const balanceAfterDepositNum = Math.max(
        details.totalPriceNum - depositNum,
        0,
      );

      // Branch copy on `finalized`. The template owns the visual variance;
      // we pass only the fields the chosen branch reads (the rest null).
      // `props` is the source of truth for the outbox `payload` log too.
      const props = finalized
        ? {
            guestName: details.guestName,
            propertyName: details.propertyName,
            dateLong,
            timeLabel,
            guestCount: details.guestCount,
            finalized: true,
            // Amount still settling on the day: full total for a
            // no-deposit bid, remaining balance for a paid deposit. Hide
            // the line if nothing is owed at the property.
            atPropertyAmount:
              balanceAfterDepositNum > 0
                ? formatMoney(balanceAfterDepositNum)
                : null,
            depositAmount: null,
            balanceAfterDeposit: null,
            bidUrl: null,
          }
        : {
            guestName: details.guestName,
            propertyName: details.propertyName,
            dateLong,
            timeLabel,
            guestCount: details.guestCount,
            finalized: false,
            atPropertyAmount: null,
            depositAmount: formatMoney(depositNum),
            balanceAfterDeposit:
              balanceAfterDepositNum > 0
                ? formatMoney(balanceAfterDepositNum)
                : null,
            bidUrl,
          };

      const subject = finalized
        ? `You're all set — ${details.propertyName} on ${dateLong}`
        : `Waiver received — one step left for ${details.propertyName}`;

      const result = await getEmailService().send({
        to: details.guestEmail,
        from: DEFAULT_FROM_EMAIL,
        subject,
        source: "waiver_signed",
        idempotencyKey: `bid:${bidId}`,
        template: {
          name: finalized ? "waiver_signed_finalized" : "waiver_signed_pay_deposit",
          element: createElement(WaiverSigned, props),
          props,
        },
      });

      if (!result.ok) {
        throw new Error(
          `email send failed for bid ${bidId}: ${result.error ?? "unknown"}`,
        );
      }

      return { messageId: result.id ?? null };
    });

    return { ok: true, bidId, finalized, messageId: sendResult.messageId };
  },
);
