import "server-only";
import { createElement } from "react";
import { inngest } from "../client";
import { bidCreated } from "../events";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
  getSiteOrigin,
} from "@/src/services/notifications/send-email";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import { GuestBookingConfirmation } from "@/src/components/email/templates/guest-booking-confirmation";

// W5 — subscribes to `bid/created` and sends the guest's "we're
// preparing your bid" confirmation email. Replaces the prior inline
// `after()` send in src/services/bookings/create-public-booking.ts —
// failures here become Inngest-visible retries (default 3 + backoff)
// instead of caller-logged warnings, and the function shows up as a
// replayable run in the dashboard.
//
// Event payload (bid/created) supplies bidPath (the relative URL with
// the one-time plaintext access code already embedded) and guestEmail.
// Everything else — guest name, property name, start time — comes from
// the DB via a single bookings → properties join. Going to the DB on
// each run (rather than expanding the event payload further) keeps the
// plaintext access code as the only secret in event storage.
//
// Step shape:
//   1. `lookup-booking-details` — one bookings select with joined
//      property fields. Its return value is cached by Inngest, so on a
//      `send` retry we don't re-query.
//   2. `send` — render the React Email template, send via
//      getEmailService(). Throws on `!result.ok` so Inngest retries
//      transient transport failures (Resend rate-limit, SMTP timeout)
//      independently from the lookup step.

// `.single<JoinedRow>()` overrides PostgREST's default inferred shape —
// without it, the joined `properties` field types as `[]` rather than a
// single nested object. Same pattern as src/services/bids/get-bid.ts.
type BookingLookupRow = {
  guest_name: string;
  start_time: string;
  properties: { name: string; timezone: string } | null;
};

export const sendBidConfirmationEmail = inngest.createFunction(
  {
    id: "send-bid-confirmation-email",
    triggers: [bidCreated],
  },
  async ({ event, step }) => {
    const { bidId, bookingId, guestEmail, bidPath } = event.data;

    const details = await step.run("lookup-booking-details", async () => {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("bookings")
        .select("guest_name, start_time, properties ( name, timezone )")
        .eq("id", bookingId)
        .single<BookingLookupRow>();

      if (error || !data) {
        throw new Error(
          `lookup-booking-details failed for booking ${bookingId}: ${
            error?.message ?? "no row"
          }`,
        );
      }

      if (!data.properties) {
        throw new Error(
          `lookup-booking-details: booking ${bookingId} missing joined property`,
        );
      }

      return {
        guestName: data.guest_name,
        startTime: data.start_time,
        propertyName: data.properties.name,
        propertyTimezone: data.properties.timezone,
      };
    });

    const sendResult = await step.run("send", async () => {
      const bidUrl = `${getSiteOrigin()}${bidPath}`;
      const dateLong = formatDateLongTz(
        details.startTime,
        details.propertyTimezone,
      );
      // Hardcoded " CT" matches the prior inline email and the funnel UI;
      // all three current properties are America/Chicago. Swap to a
      // timezone-derived abbreviation if a non-CT property is added.
      const timeLabel = `${formatSlotLabelTz(
        details.startTime,
        details.propertyTimezone,
      )} CT`;

      const props = {
        guestName: details.guestName,
        propertyName: details.propertyName,
        dateLong,
        timeLabel,
        bidUrl,
      };

      const result = await getEmailService().send({
        to: guestEmail,
        from: DEFAULT_FROM_EMAIL,
        subject: `We're preparing your bid for ${props.propertyName}`,
        source: "public_booking",
        template: {
          name: "guest_booking_confirmation",
          element: createElement(GuestBookingConfirmation, props),
          props,
        },
      });

      if (!result.ok) {
        // Throw so Inngest retries. The prior inline path swallowed
        // this and logged — that was the explicit reason for migrating
        // the send to a workflow.
        throw new Error(
          `email send failed for bid ${bidId}: ${result.error ?? "unknown"}`,
        );
      }

      return { messageId: result.id ?? null };
    });

    return { ok: true, bidId, messageId: sendResult.messageId };
  },
);
