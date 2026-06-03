import "server-only";
import { createElement } from "react";
import { inngest } from "../client";
import { bookingConfirmed } from "../events";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  DEFAULT_FROM_EMAIL,
  getEmailService,
  getSiteOrigin,
} from "@/src/services/notifications/send-email";
import { formatDateLongTz, formatSlotLabelTz } from "@/src/services/public/format";
import {
  getReminderCadence,
  type ReminderCadence,
} from "@/src/services/reminders/reminder-settings";
import {
  planCadence,
  type BlockKey,
  type TouchKey,
} from "@/src/services/reminders/cadence-plan";
import {
  composeReminderSections,
  type ReminderContent,
} from "@/src/services/reminders/compose-sections";
import { PreVisit } from "@/src/components/email/templates/pre-visit";
import { PostEventFollowup } from "@/src/components/email/templates/post-event-followup";
import { getBidUrlForAdmin } from "@/src/services/bids/get-bid-url-for-admin";

// Subscribes to `booking/confirmed` and drives the pre/post-event email
// cadence (App 9 W3). The cadence offsets live in `reminder_settings`
// (config-in-DB), so the schedule retunes without a redeploy.
//
// The interesting part is late bookings. Each touch carries different
// content (the early touch has the gear list + directions). A booking
// confirmed inside one of the windows must NOT silently drop those touches.
// `planCadence` partitions the touches into "already due" (consolidated into
// one immediate kickoff email) and "still future" (each slept-until). So a
// guest who books one day out gets a single email with everything, not three
// at once and not a missing gear list.
//
// `booking/confirmed` is deduped per booking (id `booking-<id>-confirmed`),
// so exactly one cadence runs per booking even though sign + pay can both
// emit the event. Every delayed send re-checks the booking is still active —
// a refund/cancellation between scheduling and firing skips the rest.

// Booking statuses that mean "don't keep sending" — a refund moves the
// booking to 'cancelled'; denied/expired shouldn't occur post-confirmation
// but are treated as terminal defensively.
const BOOKING_INACTIVE = new Set(["cancelled", "denied", "expired"]);

interface CadenceContext {
  bookingStatus: string;
  guestName: string;
  guestEmail: string;
  guestCount: number;
  propertyName: string;
  propertyTimezone: string;
  directions: string | null;
  parking: string | null;
  arrivalContact: string | null;
  supportPhone: string | null;
  gearList: string[];
  scheduleNotes: string | null;
  bidUrl: string | null;
  mapUrl: string | null;
  cadence: ReminderCadence;
}

type CadenceLookupRow = {
  gear_list: unknown;
  schedule_notes: string | null;
  bookings: {
    status: string;
    guest_name: string;
    guest_email: string;
    guest_count: number;
    start_time: string;
    properties: {
      name: string;
      timezone: string;
      directions: string | null;
      parking: string | null;
      arrival_contact: string | null;
      support_phone: string | null;
      map_url: string | null;
    } | null;
  } | null;
};

// Tolerant parse of the gear_list jsonb ({ name, description? }[]). A gear
// entry with no usable name is dropped; description is appended when present.
function parseGearList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const name = (entry as { name?: unknown }).name;
    if (typeof name !== "string" || name.trim() === "") continue;
    const description = (entry as { description?: unknown }).description;
    out.push(
      typeof description === "string" && description.trim() !== ""
        ? `${name.trim()} — ${description.trim()}`
        : name.trim(),
    );
  }
  return out;
}

async function loadCadenceContext(bidId: string): Promise<CadenceContext> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("bids")
    .select(
      "gear_list, schedule_notes, bookings ( status, guest_name, guest_email, guest_count, start_time, properties ( name, timezone, directions, parking, arrival_contact, support_phone, map_url ) )",
    )
    .eq("id", bidId)
    .single<CadenceLookupRow>();

  if (error || !data) {
    throw new Error(
      `cadence lookup failed for bid ${bidId}: ${error?.message ?? "no row"}`,
    );
  }
  const booking = data.bookings;
  if (!booking) {
    throw new Error(`cadence lookup: bid ${bidId} missing joined booking`);
  }
  if (!booking.properties) {
    throw new Error(
      `cadence lookup: bid ${bidId} booking missing joined property`,
    );
  }

  const bidUrlResult = await getBidUrlForAdmin(supabase, bidId, getSiteOrigin());
  const cadence = await getReminderCadence(supabase);

  return {
    bookingStatus: booking.status,
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    guestCount: booking.guest_count,
    propertyName: booking.properties.name,
    propertyTimezone: booking.properties.timezone,
    directions: booking.properties.directions,
    parking: booking.properties.parking,
    arrivalContact: booking.properties.arrival_contact,
    supportPhone: booking.properties.support_phone,
    gearList: parseGearList(data.gear_list),
    scheduleNotes: data.schedule_notes,
    bidUrl: bidUrlResult.url,
    mapUrl: booking.properties.map_url,
    cadence,
  };
}

// Re-read booking status just before a delayed send. Throws on a transient
// read error (Inngest retries the step); returns false if the booking is
// gone or terminal so the caller skips the send.
async function isBookingActive(bookingId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("status")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `booking status re-check failed for ${bookingId}: ${error.message}`,
    );
  }
  if (!data) return false;
  return !BOOKING_INACTIVE.has((data as { status: string }).status);
}

// Per-touch headline / intro / subject. `kickoff` is the consolidated email;
// early/mid/final match the TouchKey values from the planner. Copy avoids
// hard-coded day counts ("tomorrow") since the offsets are configurable.
const PRE_VISIT_COPY: Record<
  "kickoff" | TouchKey,
  (propertyName: string, dateLong: string) => {
    headline: string;
    intro: string;
    subject: string;
  }
> = {
  kickoff: (propertyName, dateLong) => ({
    headline: "Everything for your visit",
    intro: `Your visit to ${propertyName} is coming up on ${dateLong}. Here's everything you'll need, all in one place.`,
    subject: `Everything for your visit to ${propertyName}`,
  }),
  early: (propertyName, dateLong) => ({
    headline: "Getting ready for your visit",
    intro: `Your visit to ${propertyName} on ${dateLong} is coming up. Here's how to get ready.`,
    subject: `Getting ready for your visit to ${propertyName}`,
  }),
  mid: (propertyName, dateLong) => ({
    headline: "Just a few days out",
    intro: `Your visit to ${propertyName} on ${dateLong} is almost here — a couple of things to know before you head out.`,
    subject: `A few days until your visit to ${propertyName}`,
  }),
  final: (propertyName, dateLong) => ({
    headline: "See you soon",
    intro: `Your visit to ${propertyName} is nearly here — ${dateLong}. Here are the final details.`,
    subject: `See you soon at ${propertyName}`,
  }),
};

function toReminderContent(
  ctx: CadenceContext,
  timeLabel: string,
): ReminderContent {
  return {
    timeLabel,
    gearList: ctx.gearList,
    scheduleNotes: ctx.scheduleNotes,
    directions: ctx.directions,
    parking: ctx.parking,
    arrivalContact: ctx.arrivalContact,
    supportPhone: ctx.supportPhone,
  };
}

async function sendPreVisitEmail(opts: {
  ctx: CadenceContext;
  bookingId: string;
  blocks: BlockKey[];
  label: "kickoff" | TouchKey;
  dateLong: string;
  timeLabel: string;
}): Promise<{ messageId: string | null }> {
  const { ctx, bookingId, blocks, label, dateLong, timeLabel } = opts;
  const sections = composeReminderSections(
    blocks,
    toReminderContent(ctx, timeLabel),
  );
  const { headline, intro, subject } = PRE_VISIT_COPY[label](
    ctx.propertyName,
    dateLong,
  );

  const props = {
    guestName: ctx.guestName,
    propertyName: ctx.propertyName,
    dateLong,
    timeLabel,
    guestCount: ctx.guestCount,
    headline,
    intro,
    sections,
    bidUrl: ctx.bidUrl,
    mapUrl: ctx.mapUrl,
  };

  const result = await getEmailService().send({
    to: ctx.guestEmail,
    from: DEFAULT_FROM_EMAIL,
    subject,
    source: "pre_event_reminder",
    idempotencyKey: `booking:${bookingId}:${label}`,
    template: { name: "pre_visit", element: createElement(PreVisit, props), props },
  });

  if (!result.ok) {
    throw new Error(
      `pre-visit (${label}) send failed for booking ${bookingId}: ${
        result.error ?? "unknown"
      }`,
    );
  }
  return { messageId: result.id ?? null };
}

async function sendFollowupEmail(opts: {
  ctx: CadenceContext;
  bookingId: string;
  dateLong: string;
}): Promise<{ messageId: string | null }> {
  const { ctx, bookingId, dateLong } = opts;
  // CTA gated by the setting (default off). Points at the site root for now;
  // swap to a dedicated membership landing path when Q15b is confirmed.
  const membershipCtaUrl = ctx.cadence.membershipCtaEnabled
    ? getSiteOrigin()
    : null;

  const props = {
    guestName: ctx.guestName,
    propertyName: ctx.propertyName,
    dateLong,
    membershipCtaUrl,
  };

  const result = await getEmailService().send({
    to: ctx.guestEmail,
    from: DEFAULT_FROM_EMAIL,
    subject: `Thanks for visiting ${ctx.propertyName}`,
    source: "post_event_followup",
    idempotencyKey: `booking:${bookingId}:followup`,
    template: {
      name: "post_event_followup",
      element: createElement(PostEventFollowup, props),
      props,
    },
  });

  if (!result.ok) {
    throw new Error(
      `follow-up send failed for booking ${bookingId}: ${
        result.error ?? "unknown"
      }`,
    );
  }
  return { messageId: result.id ?? null };
}

export const sendPreEventCadence = inngest.createFunction(
  {
    id: "send-pre-event-cadence",
    triggers: [bookingConfirmed],
  },
  async ({ event, step }) => {
    const { bookingId, bidId, eventStartAt } = event.data;

    // Capture "now" once in a step so retries/replays plan against the same
    // baseline (the past/future partition must be stable).
    const nowMs = await step.run("now", async () => Date.now());

    const ctx = await step.run("lookup", () => loadCadenceContext(bidId));

    if (!ctx.cadence.enabled) {
      return { ok: true, bookingId, skipped: "cadence-disabled" };
    }
    if (BOOKING_INACTIVE.has(ctx.bookingStatus)) {
      return { ok: true, bookingId, skipped: "booking-not-active" };
    }

    const dateLong = formatDateLongTz(eventStartAt, ctx.propertyTimezone);
    const timeLabel = `${formatSlotLabelTz(
      eventStartAt,
      ctx.propertyTimezone,
    )} CT`;

    const plan = planCadence({
      eventStartAtMs: Date.parse(eventStartAt),
      nowMs,
      cadence: ctx.cadence,
    });

    // Consolidated kickoff for any already-passed touches.
    if (plan.kickoff) {
      await step.run("send-kickoff", () =>
        sendPreVisitEmail({
          ctx,
          bookingId,
          blocks: plan.kickoff!.blocks,
          label: "kickoff",
          dateLong,
          timeLabel,
        }),
      );
    }

    // Future pre-event touches, each on its own schedule with a fresh
    // active-booking guard.
    for (const touch of plan.scheduled) {
      await step.sleepUntil(`sleep-${touch.key}`, new Date(touch.sendAtMs));
      const active = await step.run(`recheck-${touch.key}`, () =>
        isBookingActive(bookingId),
      );
      if (active) {
        await step.run(`send-${touch.key}`, () =>
          sendPreVisitEmail({
            ctx,
            bookingId,
            blocks: touch.blocks,
            label: touch.key,
            dateLong,
            timeLabel,
          }),
        );
      }
    }

    // Post-event follow-up.
    await step.sleepUntil("sleep-followup", new Date(plan.followupAtMs));
    const activeForFollowup = await step.run("recheck-followup", () =>
      isBookingActive(bookingId),
    );
    if (activeForFollowup) {
      await step.run("send-followup", () =>
        sendFollowupEmail({ ctx, bookingId, dateLong }),
      );
    }

    return { ok: true, bookingId };
  },
);
