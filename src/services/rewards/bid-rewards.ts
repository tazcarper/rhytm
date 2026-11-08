import type { SupabaseClient } from "@supabase/supabase-js";
import type { RewardsProgram } from "@/src/constants/rewards/program";
import { getRedeemableForBooking } from "@/src/services/rewards/redemption";

// Rewards on the public bid page: link a member number to the booking so
// it earns points, and tell a signed-in member what they can apply.

export interface BidRewardsContext {
  /** Member number this booking earns for, once linked. */
  linkedMemberNumber: string | null;
  /** Present only when the viewer is signed in to a membership on this booking. */
  redeemable: { balance: number; isExpired: boolean } | null;
}

export async function getBidRewardsContext(input: {
  program: RewardsProgram;
  viewerSupabase: SupabaseClient;
  serviceSupabase: SupabaseClient;
  bookingId: string;
}): Promise<BidRewardsContext> {
  const { data: booking } = await input.serviceSupabase
    .from("bookings")
    .select("reward_membership_id, memberships:reward_membership_id ( member_number )")
    .eq("id", input.bookingId)
    .maybeSingle();

  const membership = Array.isArray(booking?.memberships)
    ? booking?.memberships[0]
    : booking?.memberships;
  const linkedMemberNumber =
    (membership as { member_number?: string } | null | undefined)?.member_number ?? null;

  const redeemable = await getRedeemableForBooking(input);
  return {
    linkedMemberNumber,
    redeemable: redeemable ? { balance: redeemable.balance, isExpired: redeemable.isExpired } : null,
  };
}

export type LinkMemberNumberResult =
  | { ok: true; memberNumber: string }
  | { ok: false; message: string };

/**
 * Ties a booking to a membership by member number + last name. The last
 * name is a light check so a typo doesn't send points to a stranger's
 * household; it can't be used to read anything (the response says only
 * linked / not linked). Only active memberships at the booking's own
 * property qualify — balances are kept per property.
 */
export async function linkBookingToMemberNumber(
  serviceSupabase: SupabaseClient,
  input: { bookingId: string; memberNumber: string; lastName: string },
): Promise<LinkMemberNumberResult> {
  const memberNumber = input.memberNumber.trim().replace(/^#/, "");
  const lastName = input.lastName.trim().toLowerCase();
  const notFound: LinkMemberNumberResult = {
    ok: false,
    message: "We couldn't match that member number and last name at this property.",
  };
  if (!memberNumber || !lastName) return notFound;

  const { data: booking } = await serviceSupabase
    .from("bookings")
    .select("property_id")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (!booking) return notFound;

  const { data: membership } = await serviceSupabase
    .from("memberships")
    .select("id, member_number, membership_people ( status, people ( last_name ) )")
    .eq("property_id", booking.property_id as string)
    .eq("member_number", memberNumber)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return notFound;

  const people = (membership.membership_people ?? []) as Array<{
    status: string;
    people: { last_name: string } | { last_name: string }[] | null;
  }>;
  const nameMatches = people.some((entry) => {
    if (entry.status !== "active") return false;
    const person = Array.isArray(entry.people) ? entry.people[0] : entry.people;
    return person?.last_name?.trim().toLowerCase() === lastName;
  });
  if (!nameMatches) return notFound;

  const { error } = await serviceSupabase
    .from("bookings")
    .update({ reward_membership_id: membership.id })
    .eq("id", input.bookingId);
  if (error) {
    return { ok: false, message: "Couldn't save your member number. Try again in a moment." };
  }
  return { ok: true, memberNumber: membership.member_number as string };
}
