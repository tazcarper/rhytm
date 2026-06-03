import type { SupabaseClient } from "@supabase/supabase-js";

// Finds confirmed bids that have been awaiting the guest's signature past the
// digest threshold, grouped by property for the W2 staff digest. Only groups
// whose property has a `notification_email` are returned — a property with no
// staff inbox has nowhere to send the digest.
//
// "Stale" = status 'confirmed' (signing moves it to 'signed', so 'confirmed'
// already implies unsigned) AND confirmed_at on/before the cutoff. Sorted
// oldest-confirmed first so the most overdue bids lead each digest.
//
// Dependency-inverted: the caller (cadence/cron) passes the service-role
// client (bypasses RLS) and the cutoff timestamp (captured once in a step).

export interface StaleBid {
  bidId: string;
  guestName: string;
  guestCount: number;
  startTime: string; // ISO
  confirmedAt: string; // ISO
}

export interface StalePropertyGroup {
  propertyId: string;
  propertyName: string;
  propertyTimezone: string;
  notificationEmail: string;
  bids: StaleBid[]; // oldest confirmed first
}

type StaleBidRow = {
  id: string;
  confirmed_at: string | null;
  bookings: {
    guest_name: string;
    guest_count: number;
    start_time: string;
    properties: {
      id: string;
      name: string;
      timezone: string;
      notification_email: string | null;
    } | null;
  } | null;
};

export async function getStaleUnsignedBidsByProperty(
  supabase: SupabaseClient,
  cutoffIso: string,
): Promise<StalePropertyGroup[]> {
  const { data, error } = await supabase
    .from("bids")
    .select(
      "id, confirmed_at, bookings ( guest_name, guest_count, start_time, properties ( id, name, timezone, notification_email ) )",
    )
    .eq("status", "confirmed")
    .not("confirmed_at", "is", null)
    .lte("confirmed_at", cutoffIso)
    .order("confirmed_at", { ascending: true });

  if (error) {
    throw new Error(`stale unsigned bids query failed: ${error.message}`);
  }

  const groups = new Map<string, StalePropertyGroup>();

  // PostgREST's inferred types model embedded relations as arrays; these are
  // to-one joins (bid→booking→property) that return objects at runtime, so
  // cast through unknown to the actual row shape.
  for (const row of (data ?? []) as unknown as StaleBidRow[]) {
    const booking = row.bookings;
    const property = booking?.properties;
    // Skip rows we can't route or render — no property, or no staff inbox.
    if (!booking || !property || !property.notification_email) continue;
    if (!row.confirmed_at) continue;

    let group = groups.get(property.id);
    if (!group) {
      group = {
        propertyId: property.id,
        propertyName: property.name,
        propertyTimezone: property.timezone,
        notificationEmail: property.notification_email,
        bids: [],
      };
      groups.set(property.id, group);
    }
    group.bids.push({
      bidId: row.id,
      guestName: booking.guest_name,
      guestCount: booking.guest_count,
      startTime: booking.start_time,
      confirmedAt: row.confirmed_at,
    });
  }

  return [...groups.values()];
}
