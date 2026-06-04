import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeGuestNames } from "@/src/services/adventures/guest-manifest";

// Persist the additional-guest manifest for one RSVP. Single
// responsibility: normalize the submitted names and write them — it does
// not check who's calling (the Server Action proves ownership first) but it
// does cap the list to the RSVP's party size (guest_count - 1) read from
// the row, so a stale client can't store more names than seats.
//
// Receives an injected service-role client (members have no UPDATE RLS
// policy on rsvps — same pattern as cancel / release).

export interface SaveGuestManifestResult {
  ok: boolean;
  reason?: "not_found" | "db_error";
}

export async function saveGuestManifest(
  admin: SupabaseClient,
  { rsvpId, names }: { rsvpId: string; names: string[] },
): Promise<SaveGuestManifestResult> {
  const { data: rsvp, error } = await admin
    .from("member_adventure_rsvps")
    .select("guest_count")
    .eq("id", rsvpId)
    .maybeSingle();
  if (error) return { ok: false, reason: "db_error" };
  if (!rsvp) return { ok: false, reason: "not_found" };

  // Manifest covers everyone except the lead member.
  const guests = normalizeGuestNames(names, rsvp.guest_count - 1);

  const { error: upErr } = await admin
    .from("member_adventure_rsvps")
    .update({ guests })
    .eq("id", rsvpId);
  if (upErr) return { ok: false, reason: "db_error" };

  return { ok: true };
}
