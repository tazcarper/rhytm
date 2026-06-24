import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminBidStatus,
  AdminBookingType,
} from "./bids";
import type { AdminBookingStatus } from "./bookings";
import { getStaffIdentity, type StaffIdentity } from "./staff-identity";
import {
  getBidLineItems,
  type BidLineItem,
} from "@/src/services/bids/bid-line-items";
import { getLineOverrides, type BidLineOverride } from "./overrides";
import { getPricingEvents, type PricingEvent } from "./pricing-events";

export interface AdminBidGearItem {
  name: string;
  description?: string;
}

export interface AdminBidFaqItem {
  question: string;
  answer: string;
}

export interface AdminBidDiscipline {
  id: string;
  name: string;
  description: string | null;
}

export interface AdminBidAddOn {
  id: string;
  serviceId: string;
  addOnId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// A party member's signed waiver collected via the scan-to-sign QR. These are
// the NON-primary signers (guests): standalone-shaped rows linked to the
// booking (booking_id set, bid_id null). The primary/bid signer lives on
// `waiver` instead. Each is viewable at /admin/waivers/[id].
export interface AdminBidPartyWaiver {
  id: string;
  signedName: string;
  signerEmail: string | null;
  signedAt: string;
}

export interface AdminBidDetail {
  bid: {
    id: string;
    slug: string;
    status: AdminBidStatus;
    // Quote-only estimate bids set this false (plan §8a). Drives the admin
    // confirm flow (lock-slot-then-confirm) and the bid page's waiver suppression.
    requiresWaiver: boolean;
    scheduleNotes: string | null;
    gearList: AdminBidGearItem[];
    faq: AdminBidFaqItem[];
    quoteNote: string | null;
    staffNotes: string | null;
    denialReason: string | null;
    refundAmount: number | null;
    refundPaymentIntentId: string | null;
    expiresAt: string | null;
    signedAt: string | null;
    paidAt: string | null;
    cancelledAt: string | null;
    // App 7 — Dropbox Sign envelope reference, null until confirmed
    // bids run through createSignatureEnvelope. Admin Lifecycle card
    // surfaces this; once signed_at is set, the admin can link to
    // the signed PDF via Dropbox Sign's API.
    dropboxSignEnvelopeId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  booking: {
    id: string;
    bookingType: AdminBookingType;
    // Booking status — distinct from bid status. pending_review here means the
    // slot is still provisional (estimate path) and must be locked before confirm.
    status: AdminBookingStatus;
    startTime: string;
    endTime: string;
    durationHours: number;
    guestName: string;
    guestEmail: string;
    guestPhone: string | null;
    guestCount: number;
    guestNotes: string | null;
    audienceType: string;
    capacityReserved: number;
    // Set when a staff member booked this on a customer's behalf.
    bookedByStaff: StaffIdentity | null;
    estimatedPrice: number | null;
    confirmedPrice: number | null;
    // confirmedPrice ?? estimatedPrice — see BidBooking comment in get-bid.ts.
    // Admin Pricing card uses this for "Balance due at property."
    effectiveQuote: number | null;
    depositAmount: number | null;
    amountPaid: number;
    depositPaymentIntentId: string | null;
  };
  property: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  disciplines: AdminBidDiscipline[];
  addOns: AdminBidAddOn[];
  instructor: { id: string; name: string } | null;
  // App 7 native waiver: present once the guest has signed. The admin
  // Lifecycle card links to /admin/bids/[id]/waiver, which streams the PDF
  // via a short-lived signed URL.
  waiver: { sha256: string; signedName: string } | null;
  // Additional party members who signed via the scan-to-sign QR (oldest
  // first). The primary signer is `waiver`; these are everyone else.
  partyWaivers: AdminBidPartyWaiver[];
  // The materialized quote breakdown (base, guest fee, add-ons). Read-only
  // here; materialized at write time and backfilled for legacy bids.
  lineItems: BidLineItem[];
  // Phase 1 per-line waive/comp overrides (all rows, newest first). The card
  // takes the latest per line; the figures are admin-only (reason is sensitive).
  overrides: BidLineOverride[];
  // Source-tagged history of every confirmed_price change (manual + override).
  pricingEvents: PricingEvent[];
}

function parseGearList(gearListJson: unknown): AdminBidGearItem[] {
  if (!Array.isArray(gearListJson)) return [];
  return gearListJson.flatMap((item): AdminBidGearItem[] => {
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

function parseFaq(faqJson: unknown): AdminBidFaqItem[] {
  if (!Array.isArray(faqJson)) return [];
  return faqJson.flatMap((item): AdminBidFaqItem[] => {
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

type AdminBidJoinedRow = {
  id: string;
  booking_id: string;
  slug: string;
  status: AdminBidStatus;
  requires_waiver: boolean;
  schedule_notes: string | null;
  gear_list: unknown;
  faq: unknown;
  quote_note: string | null;
  staff_notes: string | null;
  denial_reason: string | null;
  refund_amount: string | number | null;
  refund_payment_intent_id: string | null;
  expires_at: string | null;
  signed_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  dropbox_sign_envelope_id: string | null;
  created_at: string;
  updated_at: string;
  // One-to-one embed (bid_id is UNIQUE) -> PostgREST returns an object,
  // not an array.
  waiver_documents: { pdf_sha256: string; signed_name: string } | null;
  bookings: {
    id: string;
    booking_type: AdminBookingType;
    status: AdminBookingStatus;
    start_time: string;
    end_time: string;
    duration_hours: number;
    guest_name: string;
    guest_email: string;
    guest_phone: string | null;
    guest_count: number;
    guest_notes: string | null;
    audience_type: string;
    capacity_reserved: number;
    created_by_admin_id: string | null;
    estimated_price: string | number | null;
    confirmed_price: string | number | null;
    deposit_amount: string | number | null;
    amount_paid: string | number | null;
    deposit_payment_intent_id: string | null;
    properties: {
      id: string;
      name: string;
      slug: string;
      timezone: string;
    } | null;
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
  } | null;
};

export async function getAdminBidDetail(
  supabase: SupabaseClient,
  bidId: string,
): Promise<AdminBidDetail | null> {
  const { data, error } = await supabase
    .from("bids")
    .select(
      `
      id, booking_id, slug, status, requires_waiver,
      schedule_notes, gear_list, faq,
      quote_note, staff_notes, denial_reason, refund_amount, refund_payment_intent_id,
      expires_at, signed_at, paid_at, cancelled_at,
      dropbox_sign_envelope_id,
      created_at, updated_at,
      waiver_documents ( pdf_sha256, signed_name ),
      bookings (
        id, booking_type, status, start_time, end_time, duration_hours,
        guest_name, guest_email, guest_phone, guest_count, guest_notes,
        audience_type, capacity_reserved, created_by_admin_id,
        estimated_price, confirmed_price, deposit_amount, amount_paid, deposit_payment_intent_id,
        properties ( id, name, slug, timezone ),
        instructors ( id, name ),
        booking_disciplines ( services ( id, name, description ) ),
        booking_add_ons (
          id, service_id, add_on_id, quantity, unit_price_at_booking,
          add_ons ( id, name )
        )
      )
      `,
    )
    .eq("id", bidId)
    .maybeSingle<AdminBidJoinedRow>();

  if (error) {
    throw new Error(`Admin bid detail failed: ${error.message}`);
  }
  if (!data || !data.bookings || !data.bookings.properties) {
    return null;
  }

  const booking = data.bookings;
  const disciplines: AdminBidDiscipline[] = (booking.booking_disciplines ?? [])
    .map((row) => row.services)
    .filter((service): service is NonNullable<typeof service> => service !== null);

  const addOns: AdminBidAddOn[] = (booking.booking_add_ons ?? [])
    .filter((row) => row.add_ons !== null)
    .map((row) => ({
      id: row.id,
      serviceId: row.service_id,
      addOnId: row.add_on_id,
      name: row.add_ons!.name,
      quantity: row.quantity,
      unitPrice: toNumber(row.unit_price_at_booking) ?? 0,
    }));

  const waiverRow = data.waiver_documents ?? null;
  const bookedByStaff = booking.created_by_admin_id
    ? await getStaffIdentity(booking.created_by_admin_id)
    : null;

  // Party waivers: the scan-to-sign guests, linked to the booking (not the
  // bid). Read through the caller's RLS scope — admins see all; property
  // managers see their property's standalone rows.
  const { data: partyRows, error: partyError } = await supabase
    .from("waiver_documents")
    .select("id, signed_name, signer_email, created_at")
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: true });
  if (partyError) {
    throw new Error(`Admin bid party waivers failed: ${partyError.message}`);
  }
  const partyWaivers: AdminBidPartyWaiver[] = (partyRows ?? []).map((row) => ({
    id: row.id as string,
    signedName: row.signed_name as string,
    signerEmail: (row.signer_email as string | null) ?? null,
    signedAt: row.created_at as string,
  }));

  // Materialized line breakdown — pure read through the admin's RLS scope.
  // Never materializes on the read path; old bids are backfilled by
  // backfill_bid_line_items(). New/edited bids materialize at write time.
  const lineItems = await getBidLineItems(supabase, booking.id);

  // Phase 1 — per-line overrides + the source-tagged pricing history. Both read
  // through the admin's (staff-only) RLS scope.
  const [overrides, pricingEvents] = await Promise.all([
    getLineOverrides(supabase, booking.id),
    getPricingEvents(supabase, booking.id),
  ]);

  return {
    bid: {
      id: data.id,
      slug: data.slug,
      status: data.status,
      requiresWaiver: data.requires_waiver,
      scheduleNotes: data.schedule_notes,
      gearList: parseGearList(data.gear_list),
      faq: parseFaq(data.faq),
      quoteNote: data.quote_note ?? null,
      staffNotes: data.staff_notes,
      denialReason: data.denial_reason,
      refundAmount: toNumber(data.refund_amount),
      refundPaymentIntentId: data.refund_payment_intent_id,
      expiresAt: data.expires_at,
      signedAt: data.signed_at,
      paidAt: data.paid_at,
      cancelledAt: data.cancelled_at,
      dropboxSignEnvelopeId: data.dropbox_sign_envelope_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
    booking: {
      id: booking.id,
      bookingType: booking.booking_type,
      status: booking.status,
      startTime: booking.start_time,
      endTime: booking.end_time,
      durationHours: booking.duration_hours,
      guestName: booking.guest_name,
      guestEmail: booking.guest_email,
      guestPhone: booking.guest_phone,
      guestCount: booking.guest_count,
      guestNotes: booking.guest_notes,
      audienceType: booking.audience_type,
      capacityReserved: booking.capacity_reserved,
      bookedByStaff,
      estimatedPrice: toNumber(booking.estimated_price),
      confirmedPrice: toNumber(booking.confirmed_price),
      effectiveQuote:
        toNumber(booking.confirmed_price) ??
        toNumber(booking.estimated_price),
      depositAmount: toNumber(booking.deposit_amount),
      amountPaid: toNumber(booking.amount_paid) ?? 0,
      depositPaymentIntentId: booking.deposit_payment_intent_id,
    },
    property: {
      id: booking.properties!.id,
      name: booking.properties!.name,
      slug: booking.properties!.slug,
      timezone: booking.properties!.timezone,
    },
    disciplines,
    addOns,
    instructor: booking.instructors,
    waiver: waiverRow
      ? { sha256: waiverRow.pdf_sha256, signedName: waiverRow.signed_name }
      : null,
    partyWaivers,
    lineItems,
    overrides,
    pricingEvents,
  };
}
