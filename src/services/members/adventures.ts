import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAdventureDetails } from "@/src/services/adventures/display";
import {
  parseGuestManifest,
  type GuestManifestEntry,
} from "@/src/services/adventures/guest-manifest";
import { ADVENTURE_HOLD_TTL_MINUTES } from "./start-adventure-checkout";

// Member-portal adventures service. The portal's Adventures tab is now
// "my trips" — the adventures the member has an active RSVP on. Browsing
// + sign-up live on the public /adventures surface; the reserve write
// (startAdventureCheckout) runs from the public reserve page → Stripe →
// the webhook flips pending_payment → confirmed.
//
// This module provides:
//   - getMyAdventureRsvps: the member's confirmed/waitlisted trips.
//   - getAdventureReserveContext: for the public detail page to decide a
//     member's reserve eligibility (membership at the adventure's property
//     + any existing RSVP). Returns nulls for non-members (RLS).

export type RsvpStatus =
  | "confirmed"
  | "waitlisted"
  | "cancelled"
  | "pending_payment";

export interface MyAdventureTrip {
  rsvpId: string;
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
  guests: GuestManifestEntry[]; // additional guests (party size - 1)
  amountPaid: number | null;
  freeCancellationDays: number;
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
  id: string;
  status: RsvpStatus;
  guest_count: number;
  guests: unknown;
  amount_paid: string | number | null;
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
  free_cancellation_days: number;
  details: unknown;
  properties: { name: string } | { name: string }[] | null;
}

const MY_TRIPS_SELECT = `
  id, status, guest_count, guests, amount_paid,
  member_adventures (
    id, title, start_date, end_date, price, guest_price, free_cancellation_days, details,
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
    // confirmed + waitlisted only — pending_payment is an in-progress
    // checkout, not a trip yet.
    .in("status", ["confirmed", "waitlisted"]);

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
          rsvpId: row.id,
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
          guests: parseGuestManifest(row.guests),
          amountPaid: toOptionalNumber(row.amount_paid),
          freeCancellationDays: adventure.free_cancellation_days ?? 14,
        },
      ];
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return { data: trips, error: null };
}

// In-progress checkout holds (pending_payment) for the member — surfaced
// on /member/adventures as "finish reserving" with a countdown to the
// release window. RLS (rsvps: member read own) scopes to the caller.
export interface MyAdventureHold {
  adventureId: string;
  title: string;
  guestCount: number;
  holdExpiresAt: string; // ISO — updated_at + hold TTL
}

interface HoldRow {
  guest_count: number;
  updated_at: string;
  member_adventures:
    | { id: string; title: string }
    | { id: string; title: string }[]
    | null;
}

export async function getMyAdventureHolds(
  supabase: SupabaseClient,
): Promise<MyAdventureHold[]> {
  const { data, error } = await supabase
    .from("member_adventure_rsvps")
    .select("guest_count, updated_at, member_adventures ( id, title )")
    .eq("status", "pending_payment");

  if (error || !data) return [];

  const ttlMs = ADVENTURE_HOLD_TTL_MINUTES * 60_000;
  return (data as unknown as HoldRow[]).flatMap((row): MyAdventureHold[] => {
    const adventure = pickOne(row.member_adventures);
    if (!adventure) return [];
    return [
      {
        adventureId: adventure.id,
        title: adventure.title,
        guestCount: row.guest_count,
        holdExpiresAt: new Date(new Date(row.updated_at).getTime() + ttlMs).toISOString(),
      },
    ];
  });
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
    // Only a confirmed/waitlisted RSVP counts as "already reserved" — a
    // pending_payment hold lets them re-enter checkout (which reuses it).
    .in("status", ["confirmed", "waitlisted"])
    .limit(1);
  const rsvp = rsvps?.[0];
  const existingRsvp = rsvp
    ? { status: rsvp.status as RsvpStatus, guestCount: rsvp.guest_count }
    : null;

  return { membershipId, existingRsvp };
}
