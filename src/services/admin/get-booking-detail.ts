import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminBookingStatus,
} from "./bookings";
import type { AdminBookingType } from "./bids";

export interface AdminBookingDetail {
  booking: {
    id: string;
    status: AdminBookingStatus;
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
    depositAmount: number | null;
    createdAt: string;
    updatedAt: string;
  };
  property: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  bidId: string | null;
}

type BookingDetailRow = {
  id: string;
  status: AdminBookingStatus;
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
  estimated_price: number | null;
  confirmed_price: number | null;
  deposit_amount: number | null;
  created_at: string;
  updated_at: string;
  properties: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  bids: Array<{ id: string }> | { id: string } | null;
};

export async function getAdminBookingDetail(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<AdminBookingDetail | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id, status, booking_type, start_time, end_time, duration_hours,
      guest_name, guest_email, guest_phone, guest_count, guest_notes,
      audience_type, capacity_reserved,
      estimated_price, confirmed_price, deposit_amount,
      created_at, updated_at,
      properties!inner ( id, name, slug, timezone ),
      bids ( id )
    `,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin booking detail failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as BookingDetailRow;
  const bid = Array.isArray(row.bids) ? row.bids[0] : row.bids;

  return {
    booking: {
      id: row.id,
      status: row.status,
      bookingType: row.booking_type,
      startTime: row.start_time,
      endTime: row.end_time,
      durationHours: row.duration_hours,
      guestName: row.guest_name,
      guestEmail: row.guest_email,
      guestPhone: row.guest_phone,
      guestCount: row.guest_count,
      guestNotes: row.guest_notes,
      audienceType: row.audience_type,
      capacityReserved: row.capacity_reserved,
      estimatedPrice: row.estimated_price,
      confirmedPrice: row.confirmed_price,
      depositAmount: row.deposit_amount,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    property: {
      id: row.properties.id,
      name: row.properties.name,
      slug: row.properties.slug,
      timezone: row.properties.timezone,
    },
    bidId: bid?.id ?? null,
  };
}
