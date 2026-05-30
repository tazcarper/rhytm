import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";
import { bidCreated } from "@/lib/inngest/events";
import { buildBidUrl } from "@/src/services/bids/bid-url";
import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";

// Atomic booking creation. Calls the `create_public_booking` Postgres
// function (Phase 2 triggers + Phase 3 bid slug/access-code wired in).
// One round-trip; one transaction. Service-role only — public guests have
// no auth session and bookings has no anon-write RLS.

export const PublicBookingInputSchema = z.object({
  propertyId: z.uuid(),
  bookingType: z.enum(["plan_a_visit", "private_lesson", "host_an_occasion"]),
  // YYYY-MM-DD; the Postgres function combines this with slotStart at
  // America/Chicago to produce a DST-correct timestamptz.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  // HH:MM[:SS]; CST/CDT wall-clock time at the property.
  slotStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid slot time."),
  durationHours: z.number().int().positive(),
  instructorId: z.uuid().nullable(),
  guest: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.email(),
    phone: z.string().trim().min(7),
    notes: z.string().max(1000).default(""),
  }),
  guestCount: z.number().int().min(1).max(200),
  estimatedPrice: z.number().nonnegative().nullable(),
  disciplineIds: z.array(z.uuid()).default([]),
  // unit_price intentionally NOT in the payload — the Postgres function
  // derives it from add_ons.price server-side so a tampered submission
  // can't rewrite the historical price snapshot.
  addOns: z
    .array(
      z.object({
        serviceId: z.uuid(),
        addOnId: z.uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .default([]),
});

export type PublicBookingInput = z.infer<typeof PublicBookingInputSchema>;

export type CreatePublicBookingResult =
  | {
      ok: true;
      bookingId: string;
      bidSlug: string;
      bidAccessCode: string;
      bidPath: string;
    }
  | { ok: false; reason: BookingFailureReason; message: string };

export type BookingFailureReason =
  | "validation"
  | "slot_taken"
  | "instructor_unavailable"
  | "invalid_start_time"
  | "no_instructor"
  | "invalid_combination"
  | "unknown";

export async function createPublicBooking(
  input: PublicBookingInput,
): Promise<CreatePublicBookingResult> {
  const parsed = PublicBookingInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "validation",
      message: parsed.error.issues[0]?.message ?? "Invalid booking details.",
    };
  }

  const accessCode = generateAccessCode();
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.rpc("create_public_booking", {
    p_property_id: parsed.data.propertyId,
    p_booking_type: parsed.data.bookingType,
    p_audience_type: "public",
    p_date: parsed.data.date,
    p_slot_start: parsed.data.slotStart,
    p_duration_hours: parsed.data.durationHours,
    p_instructor_id: parsed.data.instructorId,
    p_guest_name: parsed.data.guest.name,
    p_guest_email: parsed.data.guest.email,
    p_guest_phone: parsed.data.guest.phone,
    p_guest_count: parsed.data.guestCount,
    p_guest_notes: parsed.data.guest.notes,
    p_estimated_price: parsed.data.estimatedPrice,
    p_discipline_ids: parsed.data.disciplineIds,
    p_add_ons: parsed.data.addOns.map((a) => ({
      service_id: a.serviceId,
      add_on_id: a.addOnId,
      quantity: a.quantity,
    })),
    p_access_code: accessCode,
  });

  if (error) {
    return mapPgError(error);
  }

  // RPC returns a TABLE(...) — always an array. Guard against an
  // unexpected empty result, but don't re-prove the shape at runtime.
  type Row = { booking_id: string; bid_id: string; bid_slug: string };
  const row = (data as Row[] | null)?.[0];
  if (!row) {
    return {
      ok: false,
      reason: "unknown",
      message: "Booking created but no record returned. Please contact us.",
    };
  }

  // Fire the bid/created Inngest event post-response. Best-effort: a
  // send failure on this user-facing path must not surface as a 5xx
  // (the booking already committed and the user is being redirected to
  // their bid page). The producer-side `id` ensures Inngest dedupes if
  // a retry ever fires the same bid twice. Downstream workflows
  // subscribe inside lib/inngest/functions/ — currently the guest
  // confirmation email (W5, replaced the prior inline `after()` send)
  // and the scaffold logger; HubSpot stage create + Q7-blocked auto-
  // expiry land later.
  //
  // bidPath carries the one-time plaintext access code embedded in the
  // URL — the DB only stores the bcrypt hash, so this is the single
  // moment that value can be passed to downstream consumers.
  after(() =>
    fireBidCreatedEventBestEffort({
      bidId: row.bid_id,
      bookingId: row.booking_id,
      propertyId: parsed.data.propertyId,
      guestEmail: parsed.data.guest.email,
      bidPath: buildBidUrl(row.bid_slug, accessCode),
    }),
  );

  return {
    ok: true,
    bookingId: row.booking_id,
    bidSlug: row.bid_slug,
    bidAccessCode: accessCode,
    bidPath: buildBidUrl(row.bid_slug, accessCode),
  };
}

interface BidCreatedEventArgs {
  bidId: string;
  bookingId: string;
  propertyId: string;
  guestEmail: string;
  bidPath: string;
}

// Best-effort `bid/created` Inngest send. Runs from `after()` so it
// cannot delay the bid-page redirect. Looks up the property slug from
// propertyId (the event payload uses slug — stable, human-readable, the
// shape downstream HubSpot + per-property routing rules key off of).
// A lookup failure or send failure logs and returns; the booking is
// already committed and any missed event can be replayed manually from
// the bid id. Inngest's client retries transient HTTP failures
// internally so most network blips are absorbed inside this call.
async function fireBidCreatedEventBestEffort(
  args: BidCreatedEventArgs,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { data: property, error } = await supabase
      .from("properties")
      .select("slug")
      .eq("id", args.propertyId)
      .single();

    if (error || !property) {
      console.error(
        "[bookings/create-public-booking] property slug lookup for bid/created failed",
        { propertyId: args.propertyId, bidId: args.bidId, error },
      );
      return;
    }

    await inngest.send({
      // Stable dedupe id — Inngest drops repeats within its dedupe
      // window, so a retried `after()` callback can't double-fire the
      // downstream workflows.
      id: `bid-${args.bidId}-created`,
      name: bidCreated.name,
      data: {
        bidId: args.bidId,
        bookingId: args.bookingId,
        propertySlug: (property as { slug: string }).slug,
        guestEmail: args.guestEmail,
        bidPath: args.bidPath,
      },
    });
  } catch (err) {
    console.error(
      "[bookings/create-public-booking] inngest bid/created send failed",
      { bidId: args.bidId, err },
    );
  }
}

// Generates 32 random bytes, base64url-encoded. Plaintext is shown once
// in the redirect + emailed; the bcrypt hash is stored in bids.access_code_hash.
function generateAccessCode(): string {
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Postgres error codes → user-facing reasons. Codes match Phase 2's
// trigger RAISEs and Postgres standard error classes.
function mapPgError(error: {
  code?: string;
  message?: string;
}): CreatePublicBookingResult {
  const code = error.code;
  const message = error.message ?? "";

  // EXCLUSION constraint (Phase 2 instructor exclusion on tstzrange)
  if (code === "23P01") {
    return {
      ok: false,
      reason: "instructor_unavailable",
      message: "That instructor is no longer available — pick another time.",
    };
  }

  // P0001 — generic "raise_exception". Phase 2 uses it in two places:
  //   - bookings_03_check_property_capacity: message contains "capacity"
  //     ("property is at capacity for the requested time window …")
  //   - bookings_02_validate_start_time: message contains "start_time"
  //     ("start_time % is not a valid booking slot for this property")
  // The regex match below pins to substrings that appear in those exact
  // messages. If the trigger messages get reworded, update this. Pre-launch
  // hardening: replace P0001 RAISE with a custom SQLSTATE per trigger.
  if (code === "P0001") {
    if (/capacity|max_concurrent/i.test(message)) {
      return {
        ok: false,
        reason: "slot_taken",
        message: "That slot just filled — pick another time.",
      };
    }
    if (/time_slot|start_time/i.test(message)) {
      return {
        ok: false,
        reason: "invalid_start_time",
        message: "That start time isn't valid for this property.",
      };
    }
    return {
      ok: false,
      reason: "slot_taken",
      message: "That slot is no longer available — pick another time.",
    };
  }

  // P0002 — our own "no active instructors" RAISE in the function.
  if (code === "P0002") {
    return {
      ok: false,
      reason: "no_instructor",
      message:
        "No instructors are available right now. Please contact us to book.",
    };
  }

  // 23514 CHECK constraint
  if (code === "23514") {
    return {
      ok: false,
      reason: "invalid_combination",
      message: "Booking details don't match our rules. Please review and try again.",
    };
  }

  // 23503 FK violation (e.g. add-on not in service_add_ons for that service)
  if (code === "23503") {
    return {
      ok: false,
      reason: "invalid_combination",
      message: "One of your selections isn't valid for this property. Please review and try again.",
    };
  }

  return {
    ok: false,
    reason: "unknown",
    message: "We couldn't submit your booking. Please try again or contact us.",
  };
}
