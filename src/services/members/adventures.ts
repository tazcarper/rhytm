import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAdventureDetails } from "@/src/services/adventures/display";

// Member-portal adventures service. The portal's Adventures tab is now
// "my trips" — the adventures the member has an active RSVP on. Browsing
// + sign-up live on the public /adventures surface; the reserve write
// (createMemberRsvp in ./rsvps) is triggered from the public detail page.
//
// This module provides:
//   - getMyAdventureRsvps: the member's confirmed/waitlisted trips.
//   - getAdventureReserveContext: for the public detail page to decide a
//     member's reserve eligibility (membership at the adventure's property
//     + any existing RSVP). Returns nulls for non-members (RLS).

export type RsvpStatus = "confirmed" | "waitlisted" | "cancelled";

export interface MyAdventureTrip {
  adventureId: string;
  title: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;
  propertyName: string;
  category: string | null;
  location: string | null;
  durationLabel: string | null;
  datesLabel: string | null;
  priceLabel: string | null;
  price: number;
  guestPrice: number | null;
  heroImage: string | null;
  rsvpStatus: RsvpStatus;
  guestCount: number;
}

export interface MyAdventureTripsResult {
  data: MyAdventureTrip[] | null;
  error: { message: string } | null;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function toNumber(value: string | number | null): number {
  if (value === null) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
}

function toOptionalNumber(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

interface MyTripRow {
  status: RsvpStatus;
  guest_count: number;
  member_adventures:
    | MyTripAdventure
    | MyTripAdventure[]
    | null;
}

interface MyTripAdventure {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  price: string | number | null;
  guest_price: string | number | null;
  details: unknown;
  properties: { name: string } | { name: string }[] | null;
}

const MY_TRIPS_SELECT = `
  status, guest_count,
  member_adventures (
    id, title, start_date, end_date, price, guest_price, details,
    properties ( name )
  )
`;

// The member's trips. RLS scopes member_adventure_rsvps to their own; the
// embedded adventure inherits adventure RLS, so completed/cancelled
// adventures drop out (upcoming trips only). Cancelled RSVPs excluded.
export async function getMyAdventureRsvps(
  supabase: SupabaseClient,
): Promise<MyAdventureTripsResult> {
  const { data, error } = await supabase
    .from("member_adventure_rsvps")
    .select(MY_TRIPS_SELECT)
    .neq("status", "cancelled");

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const trips = (data as unknown as MyTripRow[])
    .flatMap((row): MyAdventureTrip[] => {
      const adventure = pickOne(row.member_adventures);
      if (!adventure) return []; // RLS hid it (completed/cancelled/other property)
      const property = pickOne(adventure.properties);
      const details = parseAdventureDetails(adventure.details);
      return [
        {
          adventureId: adventure.id,
          title: adventure.title,
          startDate: adventure.start_date,
          endDate: adventure.end_date,
          propertyName: property?.name ?? "—",
          category: details.category ?? null,
          location: details.location ?? null,
          durationLabel: details.durationLabel ?? null,
          datesLabel: details.datesLabel ?? null,
          priceLabel: details.priceLabel ?? null,
          price: toNumber(adventure.price),
          guestPrice: toOptionalNumber(adventure.guest_price),
          heroImage: details.heroImage ?? null,
          rsvpStatus: row.status,
          guestCount: row.guest_count,
        },
      ];
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return { data: trips, error: null };
}

export interface ReserveContext {
  membershipId: string | null;
  existingRsvp: { status: RsvpStatus; guestCount: number } | null;
}

// Reserve eligibility for the public detail page. membershipId is the
// caller's active membership at the adventure's property (null if they
// have none / aren't a member). existingRsvp is their current non-
// cancelled RSVP on this adventure. RLS scopes both reads to the caller.
export async function getAdventureReserveContext(
  supabase: SupabaseClient,
  adventureId: string,
  propertyId: string,
): Promise<ReserveContext> {
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("status", "active")
    .eq("property_id", propertyId)
    .limit(1);
  const membershipId = memberships?.[0]?.id ?? null;

  const { data: rsvps } = await supabase
    .from("member_adventure_rsvps")
    .select("status, guest_count")
    .eq("adventure_id", adventureId)
    .neq("status", "cancelled")
    .limit(1);
  const rsvp = rsvps?.[0];
  const existingRsvp = rsvp
    ? { status: rsvp.status as RsvpStatus, guestCount: rsvp.guest_count }
    : null;

  return { membershipId, existingRsvp };
}
