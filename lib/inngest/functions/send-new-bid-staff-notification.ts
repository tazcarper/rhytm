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
import { formatDateLongTz, formatSlotLabelTz } from "@/src/services/public/format";
import { NewBidStaffNotification } from "@/src/components/email/templates/new-bid-staff-notification";

// Subscribes to `bid/created` (alongside the guest confirmation handler) and
// alerts the property's staff inbox that a new request needs review — the bid
// has landed in the admin queue as `pending_review`. Recipient is the
// property's `notification_email` (config-in-DB); when it's null the property
// hasn't opted in, so the function no-ops cleanly rather than erroring.

const BOOKING_TYPE_LABELS: Record<string, string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Private Lesson",
  host_an_occasion: "Host an Occasion",
};

type NewBidLookupRow = {
  bookings: {
    guest_name: string;
    guest_email: string;
    guest_count: number;
    start_time: string;
    booking_type: string;
    properties: {
      name: string;
      timezone: string;
      notification_email: string | null;
    } | null;
  } | null;
};

export const sendNewBidStaffNotification = inngest.createFunction(
  {
    id: "send-new-bid-staff-notification",
    triggers: [bidCreated],
  },
  async ({ event, step }) => {
    const { bidId } = event.data;

    const details = await step.run("lookup-bid-details", async () => {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("bids")
        .select(
          "bookings ( guest_name, guest_email, guest_count, start_time, booking_type, properties ( name, timezone, notification_email ) )",
        )
        .eq("id", bidId)
        .single<NewBidLookupRow>();

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
        guestCount: booking.guest_count,
        startTime: booking.start_time,
        bookingType: booking.booking_type,
        propertyName: booking.properties.name,
        propertyTimezone: booking.properties.timezone,
        notificationEmail: booking.properties.notification_email,
      };
    });

    // Property hasn't configured a staff inbox — nothing to alert.
    if (!details.notificationEmail) {
      return { ok: true, bidId, skipped: "no-notification-email" };
    }

    const sendResult = await step.run("send", async () => {
      const dateLong = formatDateLongTz(
        details.startTime,
        details.propertyTimezone,
      );
      const timeLabel = `${formatSlotLabelTz(
        details.startTime,
        details.propertyTimezone,
      )} CT`;
      const bookingTypeLabel =
        BOOKING_TYPE_LABELS[details.bookingType] ?? details.bookingType;
      const reviewUrl = `${getSiteOrigin()}/admin/bids/${bidId}`;

      const props = {
        propertyName: details.propertyName,
        guestName: details.guestName,
        guestEmail: details.guestEmail,
        dateLong,
        timeLabel,
        guestCount: details.guestCount,
        bookingTypeLabel,
        reviewUrl,
      };

      const result = await getEmailService().send({
        to: details.notificationEmail as string,
        from: DEFAULT_FROM_EMAIL,
        subject: `New booking request — ${details.propertyName} on ${dateLong}`,
        source: "staff_new_bid",
        idempotencyKey: `bid:${bidId}`,
        template: {
          name: "new_bid_staff_notification",
          element: createElement(NewBidStaffNotification, props),
          props,
        },
      });

      if (!result.ok) {
        throw new Error(
          `staff notification send failed for bid ${bidId}: ${
            result.error ?? "unknown"
          }`,
        );
      }
      return { messageId: result.id ?? null };
    });

    return { ok: true, bidId, messageId: sendResult.messageId };
  },
);
