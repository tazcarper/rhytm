import "server-only";
import { createElement } from "react";
import { inngest } from "../client";
import { bidDenied } from "../events";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
} from "@/src/services/notifications/send-email";
import { formatDateLongTz, formatSlotLabelTz } from "@/src/services/public/format";
import { BidDenied } from "@/src/components/email/templates/bid-denied";

// Subscribes to `bid/denied` and sends the guest a courteous "we couldn't
// confirm this request" email after an admin declines a pending bid. Mirrors
// send-bid-confirmed-email.ts: a cached lookup step + a send step that throws
// on failure so Inngest retries transient transport errors.
//
// No bid-page URL — a denied bid has nowhere to go; the email invites a reply
// or a fresh request instead.

type BidDeniedLookupRow = {
  denial_reason: string | null;
  bookings: {
    guest_name: string;
    guest_email: string;
    start_time: string;
    properties: { name: string; timezone: string } | null;
  } | null;
};

export const sendBidDeniedEmail = inngest.createFunction(
  {
    id: "send-bid-denied-email",
    triggers: [bidDenied],
  },
  async ({ event, step }) => {
    const { bidId } = event.data;

    const details = await step.run("lookup-bid-details", async () => {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("bids")
        .select(
          "denial_reason, bookings ( guest_name, guest_email, start_time, properties ( name, timezone ) )",
        )
        .eq("id", bidId)
        .single<BidDeniedLookupRow>();

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

      return {
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        startTime: booking.start_time,
        propertyName: booking.properties.name,
        propertyTimezone: booking.properties.timezone,
        reason: data.denial_reason,
      };
    });

    const sendResult = await step.run("send", async () => {
      const dateLong = formatDateLongTz(
        details.startTime,
        details.propertyTimezone,
      );
      const timeLabel = `${formatSlotLabelTz(
        details.startTime,
        details.propertyTimezone,
      )} CT`;

      const props = {
        guestName: details.guestName,
        propertyName: details.propertyName,
        dateLong,
        timeLabel,
        reason: details.reason,
      };

      const result = await getEmailService().send({
        to: details.guestEmail,
        from: DEFAULT_FROM_EMAIL,
        subject: `About your booking request — ${details.propertyName}`,
        source: "admin_deny",
        idempotencyKey: `bid:${bidId}`,
        template: {
          name: "bid_denied",
          element: createElement(BidDenied, props),
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
