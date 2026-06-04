import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/auth/portal";
import {
  getAdventureForPreview,
  getPublicAdventure,
} from "@/src/services/public/adventures";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;

  // Public read (published/sold_out only). For a staff viewer following the
  // admin "View public page" link before publishing, fall back to a
  // status-agnostic preview read.
  let adventure = await getPublicAdventure(supabase, id);
  let preview = false;
  if (!adventure && hasAdminAccess(role)) {
    adventure = await getAdventureForPreview(supabase, id);
    preview = adventure !== null;
  }
  if (!adventure) notFound();

  const isMember = role === "member";
  let reserve: ReserveState = { isMember, membershipId: null, existingRsvp: null };
  if (isMember) {
    const ctx = await getAdventureReserveContext(supabase, adventure.id, adventure.propertyId);
    reserve = { isMember, membershipId: ctx.membershipId, existingRsvp: ctx.existingRsvp };
  }

  return <AdventureDetailView adventure={adventure} reserve={reserve} preview={preview} />;
}
