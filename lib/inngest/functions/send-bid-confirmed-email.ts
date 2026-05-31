import "server-only";
import { createElement } from "react";
import { inngest } from "../client";
import { bidConfirmed } from "../events";
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
import { BidConfirmedWithDeposit } from "@/src/components/email/templates/bid-confirmed-with-deposit";
import { BidConfirmedNoDeposit } from "@/src/components/email/templates/bid-confirmed-no-deposit";
import { getBidUrlForAdmin } from "@/src/services/bids/get-bid-url-for-admin";

// Subscribes to `bid/confirmed` and sends the guest the orientation
// email after an admin approves a pending bid. The bid is now actionable:
// the guest signs the liability waiver on their bid page and (when a
// deposit is set) pays the deposit there too.
//
// Two template variants — picked by whether a deposit is set:
//   - BidConfirmedWithDeposit: sign waiver + pay deposit + guests at check-in
//   - BidConfirmedNoDeposit:   sign waiver + guests at check-in
// Both link to the bid page via the recovered plaintext URL (or fall back
// to the "use your original email" copy for legacy bids without one).
//
// Step shape:
//   1. `lookup-bid-details` — single bids→bookings→properties join.
//      Inngest caches the return so a retry of `send` doesn't re-query.
//   2. `resolve-bid-url` — pull the plaintext access code (stored on
//      bids since 20260530170000) and assemble the absolute URL. Returns
//      null for legacy bids; template falls back accordingly.
//   3. `send` — render + send. Throws on `!result.ok` so Inngest retries
//      transient transport failures independently from the lookup step.

type BidLookupRow = {
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

export const sendBidConfirmedEmail = inngest.createFunction(
  {
    id: "send-bid-confirmed-email",
    triggers: [bidConfirmed],
  },
  async ({ event, step }) => {
    const { bidId } = event.data;

    const details = await step.run("lookup-bid-details", async () => {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("bids")
        .select(
          "bookings ( guest_name, guest_email, guest_count, start_time, estimated_price, confirmed_price, deposit_amount, properties ( name, timezone ) )",
        )
        .eq("id", bidId)
        .single<BidLookupRow>();

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

      // Numeric columns arrive as strings over PostgREST. Coerce to
      // Number for arithmetic; the effective quote is admin's
      // confirmed_price override, falling back to the auto-estimate
      // (matches BidBooking.effectiveQuote on the bid page).
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
      };
    });

    const bidUrl = await step.run("resolve-bid-url", async () => {
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
      // properties are America/Chicago today. Swap to a tz-derived
      // abbreviation when a non-CT property is added.
      const timeLabel = `${formatSlotLabelTz(
        details.startTime,
        details.propertyTimezone,
      )} CT`;

      const totalPrice = formatMoney(details.totalPriceNum);
      const hasDeposit =
        details.depositNum !== null && details.depositNum > 0;

      // Branch the template on whether a deposit is owed. The shared
      // BidConfirmedLayout shell renders the chrome; each variant owns
      // its "what's next" copy. `props` carries only the fields the
      // chosen template declares — keep it the source of truth for the
      // outbox `payload` log too.
      const commonProps = {
        guestName: details.guestName,
        propertyName: details.propertyName,
        dateLong,
        timeLabel,
        guestCount: details.guestCount,
        totalPrice,
        bidUrl,
      };

      const { templateName, props, element } = hasDeposit
        ? (() => {
            const depositAmount = formatMoney(details.depositNum as number);
            const balanceDue = formatMoney(
              Math.max(
                details.totalPriceNum - (details.depositNum as number),
                0,
              ),
            );
            const withDepositProps = {
              ...commonProps,
              depositAmount,
              balanceDue,
            };
            return {
              templateName: "bid_confirmed_with_deposit",
              props: withDepositProps,
              element: createElement(
                BidConfirmedWithDeposit,
                withDepositProps,
              ),
            };
          })()
        : {
            templateName: "bid_confirmed_no_deposit",
            props: commonProps,
            element: createElement(BidConfirmedNoDeposit, commonProps),
          };

      const result = await getEmailService().send({
        to: details.guestEmail,
        from: DEFAULT_FROM_EMAIL,
        subject: `Your bid is confirmed — ${details.propertyName} on ${dateLong}`,
        source: "admin_confirm",
        idempotencyKey: `bid:${bidId}`,
        template: {
          name: templateName,
          element,
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

    return { ok: true, bidId, messageId: sendResult.messageId };
  },
);
