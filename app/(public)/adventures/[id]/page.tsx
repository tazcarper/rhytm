import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicAdventure } from "@/src/services/public/adventures";
import { getAdventureReserveContext } from "@/src/services/members/adventures";
import {
  AdventureDetailView,
  type ReserveState,
} from "@/src/components/public/adventure-detail-view";

export const dynamic = "force-dynamic";

// Public adventure detail + sign-up. Anyone can read (data via the
// SECURITY DEFINER public_member_adventures RPC). For a signed-in member
// we resolve their reserve eligibility (active membership at this
// adventure's property + any existing RSVP); the panel gates the rest.
// 404 for unknown / non-published ids.
export default async function PublicAdventurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const adventure = await getPublicAdventure(supabase, id);
  if (!adventure) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isMember = user?.app_metadata?.role === "member";

  let reserve: ReserveState = { isMember, membershipId: null, existingRsvp: null };
  if (isMember) {
    const ctx = await getAdventureReserveContext(supabase, adventure.id, adventure.propertyId);
    reserve = { isMember, membershipId: ctx.membershipId, existingRsvp: ctx.existingRsvp };
  }

  return <AdventureDetailView adventure={adventure} reserve={reserve} />;
}
