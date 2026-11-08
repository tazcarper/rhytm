import type { SupabaseClient } from "@supabase/supabase-js";

// Which membership (household) should earn points for a booking?
//
// Ordered strategies — the first one that finds an ACTIVE membership at the
// booking's property wins. Add a new way to recognise a member by appending
// a strategy; nothing else changes (Open/Closed).
//
//   1. linked     — the guest typed their member number on the bid page
//   2. logged in  — the booking was made from a signed-in member account
//   3. email      — the booking email belongs to a person on a membership
//
// Members only: a booking that matches none earns nothing.
//
// Runs with a service-role client (webhook context, no user session).

export interface BookingRewardContext {
  bookingId: string;
  propertyId: string;
  memberUserId: string | null;
  guestEmail: string | null;
  rewardMembershipId: string | null;
}

type ResolveStrategy = (
  supabase: SupabaseClient,
  booking: BookingRewardContext,
) => Promise<string | null>;

async function activeMembershipForPerson(
  supabase: SupabaseClient,
  personId: string,
  propertyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("membership_people")
    .select("membership_id, memberships!inner ( id, property_id, status )")
    .eq("person_id", personId)
    .eq("status", "active")
    .eq("memberships.property_id", propertyId)
    .eq("memberships.status", "active")
    .limit(1)
    .maybeSingle();
  return (data?.membership_id as string | undefined) ?? null;
}

const linkedOnBooking: ResolveStrategy = async (supabase, booking) => {
  if (!booking.rewardMembershipId) return null;
  const { data } = await supabase
    .from("memberships")
    .select("id")
    .eq("id", booking.rewardMembershipId)
    .eq("property_id", booking.propertyId)
    .eq("status", "active")
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
};

const bookedWhileLoggedIn: ResolveStrategy = async (supabase, booking) => {
  if (!booking.memberUserId) return null;
  const { data: person } = await supabase
    .from("people")
    .select("id")
    .eq("user_id", booking.memberUserId)
    .maybeSingle();
  if (!person) return null;
  return activeMembershipForPerson(supabase, person.id as string, booking.propertyId);
};

const bookingEmailMatchesMember: ResolveStrategy = async (supabase, booking) => {
  const email = booking.guestEmail?.trim();
  if (!email) return null;
  const { data: person } = await supabase
    .from("people")
    .select("id")
    // Case-insensitive exact match; LIKE wildcards escaped.
    .ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .maybeSingle();
  if (!person) return null;
  return activeMembershipForPerson(supabase, person.id as string, booking.propertyId);
};

const STRATEGIES: ReadonlyArray<ResolveStrategy> = [
  linkedOnBooking,
  bookedWhileLoggedIn,
  bookingEmailMatchesMember,
];

export async function resolveRewardMembershipForBooking(
  supabase: SupabaseClient,
  booking: BookingRewardContext,
): Promise<string | null> {
  for (const strategy of STRATEGIES) {
    const membershipId = await strategy(supabase, booking);
    if (membershipId) return membershipId;
  }
  return null;
}

/** Loads the fields the resolver needs. */
export async function loadBookingRewardContext(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<BookingRewardContext | null> {
  const { data } = await supabase
    .from("bookings")
    .select("id, property_id, member_user_id, guest_email, reward_membership_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!data) return null;
  return {
    bookingId: data.id as string,
    propertyId: data.property_id as string,
    memberUserId: (data.member_user_id as string | null) ?? null,
    guestEmail: (data.guest_email as string | null) ?? null,
    rewardMembershipId: (data.reward_membership_id as string | null) ?? null,
  };
}
