import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminBidStatus,
  AdminBookingType,
} from "./bids";

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

export interface AdminBidDetail {
  bid: {
    id: string;
    slug: string;
    status: AdminBidStatus;
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
      id, booking_id, slug, status,
      schedule_notes, gear_list, faq,
      quote_note, staff_notes, denial_reason, refund_amount, refund_payment_intent_id,
      expires_at, signed_at, paid_at, cancelled_at,
      dropbox_sign_envelope_id,
      created_at, updated_at,
      waiver_documents ( pdf_sha256, signed_name ),
      bookings (
        id, booking_type, start_time, end_time, duration_hours,
        guest_name, guest_email, guest_phone, guest_count, guest_notes,
        audience_type, capacity_reserved,
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

  return {
    bid: {
      id: data.id,
      slug: data.slug,
      status: data.status,
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
  };
}
