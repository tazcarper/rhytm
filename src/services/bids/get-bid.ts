import { createServiceRoleClient } from "@/lib/supabase/service";
import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";
import type { PublicProperty } from "@/src/services/public/properties";

// Public bid fetch.
//
// Two-step access:
//   1. Call validate_bid_access_code(slug, code) — Phase 3 RPC,
//      SECURITY DEFINER, runs a bcrypt verify against bids.access_code_hash.
//      Returns one row on match, zero on miss. The function also runs a
//      dummy bcrypt verify on the miss path so timing cannot leak slug
//      existence. We invoke via the service-role client because the
//      follow-up booking fetch needs service-role anyway (anon has no
//      SELECT RLS on bookings, by design — per Phase 3 plan).
//   2. Fetch the booking row + nested property / disciplines / add_ons /
//      instructor with a single PostgREST select.
//
// On any miss the caller renders a 404 — never 401, never an error
// message that would distinguish "slug exists but wrong code" from
// "slug doesn't exist".

export type BidStatus =
  | "pending_review"
  | "confirmed"
  | "denied"
  | "signed"
  | "paid"
  | "expired"
  | "refunded";

export interface BidGearItem {
  name: string;
  description?: string;
}

export interface BidFaqItem {
  question: string;
  answer: string;
}

export interface BidDiscipline {
  id: string;
  name: string;
  description: string | null;
}

export interface BidAddOn {
  id: string;
  serviceId: string;
  addOnId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// Bid page renders the same property fields the funnel does, with the
// extra `bookingHorizonDays` (only used on the funnel) coming along for
// free. Importing the funnel type keeps property shape in one file —
// adding a column later updates both surfaces in lockstep.
export type BidProperty = PublicProperty;

export interface BidBooking {
  id: string;
  bookingType: BookingType;
  startTime: string;
  endTime: string;
  durationHours: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  guestCount: number;
  guestNotes: string | null;
  estimatedPrice: number | null;
  confirmedPrice: number | null;
  // The customer-facing "quote ceiling" used by the variable-amount
  // payment flow. Coalesces confirmedPrice to estimatedPrice when the
  // admin hasn't overridden the auto-estimate. Null only when both
  // are null (rare — pricing rules failed AND no quote authored).
  effectiveQuote: number | null;
  depositAmount: number | null;
  // Whether this bid collects a deposit at all. A non-positive
  // deposit_amount (null OR 0) means NO deposit is required — the bid page
  // hides the payment step entirely and the waiver signature alone
  // finalizes the booking. Only a positive amount triggers the Stripe flow.
  requiresDeposit: boolean;
  // Actual amount paid via Stripe (App 6 Path A). Defaults to 0
  // server-side, so 0 == "not paid yet." Always numeric.
  amountPaid: number;
}

export interface BidDetail {
  bid: {
    id: string;
    slug: string;
    status: BidStatus;
    scheduleNotes: string | null;
    gearList: BidGearItem[];
    faq: BidFaqItem[];
    quoteNote: string | null;
    expiresAt: string | null;
    signedAt: string | null;
    paidAt: string | null;
    // App 7 — if non-null, the bid has an embedded sign envelope
    // ready. The bid page mounts the SignatureForm when this is set
    // AND signedAt is null. Renders the "Signed ✓" affordance when
    // signedAt is set (regardless of this column).
    dropboxSignEnvelopeId: string | null;
    createdAt: string;
  };
  booking: BidBooking;
  property: BidProperty;
  disciplines: BidDiscipline[];
  addOns: BidAddOn[];
  instructor: { id: string; name: string } | null;
}

// JSONB columns are untyped at the DB layer — narrow defensively. Staff
// authoring (App 3) will write objects of the shape below, but until that
// admin UI lands the column may hold whatever the seed scripts put in.
// Anything that doesn't shape-match is dropped silently rather than
// crashing the bid page.
function parseGearList(gearListJson: unknown): BidGearItem[] {
  if (!Array.isArray(gearListJson)) return [];
  return gearListJson.flatMap((item): BidGearItem[] => {
    if (typeof item === "string") return [{ name: item }];
    if (item && typeof item === "object" && "name" in item) {
      const candidate = item as { name: unknown; description?: unknown };
      if (typeof candidate.name !== "string") return [];
      return [
        {
          name: candidate.name,
          description:
            typeof candidate.description === "string"
              ? candidate.description
              : undefined,
        },
      ];
    }
    return [];
  });
}

function parseFaq(faqJson: unknown): BidFaqItem[] {
  if (!Array.isArray(faqJson)) return [];
  return faqJson.flatMap((item): BidFaqItem[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { question?: unknown; answer?: unknown };
    if (
      typeof candidate.question !== "string" ||
      typeof candidate.answer !== "string"
    ) {
      return [];
    }
    return [{ question: candidate.question, answer: candidate.answer }];
  });
}

function toNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

type RpcBidRow = {
  id: string;
  booking_id: string;
  slug: string;
  status: BidStatus;
  schedule_notes: string | null;
  gear_list: unknown;
  faq: unknown;
  quote_note: string | null;
  expires_at: string | null;
  signed_at: string | null;
  paid_at: string | null;
  dropbox_sign_envelope_id: string | null;
  created_at: string;
};

type PropertyRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  booking_horizon_days: number;
  tagline: string | null;
};

type BookingJoinedRow = {
  id: string;
  booking_type: BookingType;
  start_time: string;
  end_time: string;
  duration_hours: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_count: number;
  guest_notes: string | null;
  estimated_price: string | number | null;
  confirmed_price: string | number | null;
  deposit_amount: string | number | null;
  amount_paid: string | number | null;
  properties: PropertyRow | null;
  instructors: { id: string; name: string } | null;
  booking_disciplines: Array<{
    services: {
      id: string;
      name: string;
      description: string | null;
    } | null;
  }> | null;
  booking_add_ons: Array<{
    id: string;
    service_id: string;
    add_on_id: string;
    quantity: number;
    unit_price_at_booking: string | number;
    add_ons: { id: string; name: string } | null;
  }> | null;
};

export async function getBidDetail(
  slug: string,
  code: string,
): Promise<BidDetail | null> {
  const supabase = createServiceRoleClient();

  const { data: bidData, error: bidErr } = await supabase.rpc(
    "validate_bid_access_code",
    { p_slug: slug, p_code: code },
  );

  // Infrastructure failure (network, auth). Throw with a stable
  // message — Postgres error.message can name schemas/functions and
  // would surface in the Next.js error page in dev/preview builds.
  if (bidErr) {
    console.error("[bids/get-bid] validate_bid_access_code failed", bidErr);
    throw new Error("Bid lookup failed.");
  }

  const bidRow = Array.isArray(bidData)
    ? (bidData[0] as RpcBidRow | undefined)
    : undefined;
  if (!bidRow) return null;

  const { data: bookingRow, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      `
      id,
      booking_type,
      start_time,
      end_time,
      duration_hours,
      guest_name,
      guest_email,
      guest_phone,
      guest_count,
      guest_notes,
      estimated_price,
      confirmed_price,
      deposit_amount,
      amount_paid,
      properties ( id, name, slug, timezone, booking_horizon_days, tagline ),
      instructors ( id, name ),
      booking_disciplines ( services ( id, name, description ) ),
      booking_add_ons (
        id, service_id, add_on_id, quantity, unit_price_at_booking,
        add_ons ( id, name )
      )
      `,
    )
    .eq("id", bidRow.booking_id)
    .single<BookingJoinedRow>();

  // Bid exists but its booking/property doesn't (FK race, soft-delete,
  // RLS edge). Treat as "bid not findable" — return null so the page
  // 404s rather than spilling a 500 with internal detail. Log
  // server-side for incident triage.
  if (bookingErr || !bookingRow || !bookingRow.properties) {
    console.error(
      "[bids/get-bid] booking join missing for bid",
      { bidId: bidRow.id, bookingId: bidRow.booking_id, bookingErr },
    );
    return null;
  }

  const disciplines: BidDiscipline[] = (bookingRow.booking_disciplines ?? [])
    .map((row) => row.services)
    .filter((service): service is NonNullable<typeof service> => service !== null);

  const addOns: BidAddOn[] = (bookingRow.booking_add_ons ?? [])
    .filter((row) => row.add_ons !== null)
    .map((row) => ({
      id: row.id,
      serviceId: row.service_id,
      addOnId: row.add_on_id,
      name: row.add_ons!.name,
      quantity: row.quantity,
      unitPrice: toNumber(row.unit_price_at_booking) ?? 0,
    }));

  return {
    bid: {
      id: bidRow.id,
      slug: bidRow.slug,
      status: bidRow.status,
      scheduleNotes: bidRow.schedule_notes,
      gearList: parseGearList(bidRow.gear_list),
      faq: parseFaq(bidRow.faq),
      quoteNote: bidRow.quote_note ?? null,
      expiresAt: bidRow.expires_at,
      signedAt: bidRow.signed_at,
      paidAt: bidRow.paid_at,
      dropboxSignEnvelopeId: bidRow.dropbox_sign_envelope_id,
      createdAt: bidRow.created_at,
    },
    booking: {
      id: bookingRow.id,
      bookingType: bookingRow.booking_type,
      startTime: bookingRow.start_time,
      endTime: bookingRow.end_time,
      durationHours: bookingRow.duration_hours,
      guestName: bookingRow.guest_name,
      guestEmail: bookingRow.guest_email,
      guestPhone: bookingRow.guest_phone,
      guestCount: bookingRow.guest_count,
      guestNotes: bookingRow.guest_notes,
      estimatedPrice: toNumber(bookingRow.estimated_price),
      confirmedPrice: toNumber(bookingRow.confirmed_price),
      effectiveQuote:
        toNumber(bookingRow.confirmed_price) ??
        toNumber(bookingRow.estimated_price),
      depositAmount: toNumber(bookingRow.deposit_amount),
      requiresDeposit: (toNumber(bookingRow.deposit_amount) ?? 0) > 0,
      amountPaid: toNumber(bookingRow.amount_paid) ?? 0,
    },
    property: {
      id: bookingRow.properties.id,
      name: bookingRow.properties.name,
      slug: bookingRow.properties.slug,
      timezone: bookingRow.properties.timezone,
      bookingHorizonDays: bookingRow.properties.booking_horizon_days,
      tagline: bookingRow.properties.tagline ?? null,
    },
    disciplines,
    addOns,
    instructor: bookingRow.instructors,
  };
}
