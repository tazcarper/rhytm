import type { SupabaseClient } from "@supabase/supabase-js";
import type { RsvpStatus } from "./adventures";

// RSVP write service for the member portal. One job: insert a confirmed
// RSVP against an adventure. The DB does the hard part — the row-locked
// check_adventure_capacity trigger enforces the per-RSVP guest cap, the
// manual sold-out block, and total capacity; RLS ("rsvps: member insert
// own") enforces that membership_id is one of the caller's ACTIVE
// memberships; the UNIQUE (adventure_id, membership_id) rejects doubles.
// This service translates those failures into discriminated codes the UI
// can speak to. No payment (Q14): v1 RSVPs hold the spot, no charge.

export interface CreateRsvpArgs {
  adventureId: string;
  membershipId: string;
  guestCount: number;
}

export type RsvpErrorCode =
  | "capacity"
  | "manually-sold-out"
  | "guest-cap"
  | "duplicate"
  | "rls"
  | "no-person"
  | "unknown";

export type CreateRsvpResult =
  | { ok: true; rsvp: { id: string; status: RsvpStatus } }
  | { ok: false; error: RsvpErrorCode; message: string };

// Map a Postgres / PostgREST error to a discriminated code. The trigger
// RAISEs without an explicit errcode (so code is the generic P0001) —
// match those on message substring. UNIQUE + RLS carry real SQLSTATEs.
function classifyRsvpError(error: {
  code?: string;
  message?: string;
}): { error: RsvpErrorCode; message: string } {
  const message = error.message ?? "Could not reserve your spot.";
  if (error.code === "23505") {
    return { error: "duplicate", message: "You've already reserved this experience." };
  }
  if (error.code === "42501" || /row-level security/i.test(message)) {
    return {
      error: "rls",
      message: "This membership isn't active, so it can't reserve this experience.",
    };
  }
  if (/max_guests_per_rsvp/i.test(message)) {
    return { error: "guest-cap", message: "That's more guests than this experience allows per reservation." };
  }
  if (/sold-out by staff/i.test(message)) {
    return { error: "manually-sold-out", message: "This experience is full — ask the concierge about the waitlist." };
  }
  if (/at capacity/i.test(message)) {
    return { error: "capacity", message: "This experience just filled up." };
  }
  return { error: "unknown", message };
}

export async function createMemberRsvp(
  supabase: SupabaseClient,
  args: CreateRsvpArgs,
): Promise<CreateRsvpResult> {
  // Stamp the human who made it for audit (either spouse can later
  // cancel the household's RSVP). Sourced from the same SECURITY DEFINER
  // helper the RLS policies use, rather than a column default.
  const { data: personId, error: personError } = await supabase.rpc(
    "current_person_id",
  );
  if (personError) {
    return { ok: false, ...classifyRsvpError(personError) };
  }
  if (!personId) {
    return {
      ok: false,
      error: "no-person",
      message: "We couldn't find your member profile. Please contact the concierge.",
    };
  }

  const { data, error } = await supabase
    .from("member_adventure_rsvps")
    .insert({
      adventure_id: args.adventureId,
      membership_id: args.membershipId,
      created_by_person_id: personId,
      guest_count: args.guestCount,
      status: "confirmed",
    })
    .select("id, status")
    .single();

  if (error) {
    return { ok: false, ...classifyRsvpError(error) };
  }

  return { ok: true, rsvp: { id: data.id, status: data.status as RsvpStatus } };
}

// Cancellation is deferred until Q14 (cancellation + refund policy) is
// answered. The schema supports it (status='cancelled' frees the slot
// and the waitlist promoter re-reads the manual flag) but no member-
// facing path exists in v1. Kept here as the named seam so the day Q14
// lands, the action + UI bind to this and nothing else moves.
export async function cancelMemberRsvp(): Promise<CreateRsvpResult> {
  return {
    ok: false,
    error: "unknown",
    message: "Cancelling a reservation isn't available yet — contact the concierge.",
  };
}
