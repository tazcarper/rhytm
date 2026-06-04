"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createStripeClient } from "@/lib/stripe/server";
import { inngest } from "@/lib/inngest/client";
import { adventureRequested } from "@/lib/inngest/events";
import { getPublicAdventure } from "@/src/services/public/adventures";
import {
  startAdventureCheckout,
  type StartAdventureCheckoutResult,
} from "@/src/services/members/start-adventure-checkout";
import { cancelAdventureRsvp } from "@/src/services/members/cancel-adventure-rsvp";
import { saveGuestManifest } from "@/src/services/members/save-guest-manifest";

// Opens an adventure checkout: validates the caller is an eligible member
// (active membership at the adventure's property), then hands a
// service-role client + Stripe to the checkout service, which holds the
// spot (pending_payment) and opens the PaymentIntent for the full total.

const InputSchema = z.object({
  adventureId: z.string().uuid(),
  guestCount: z.number().int().positive().max(50),
});

export type StartCheckoutResult =
  | StartAdventureCheckoutResult
  | { ok: false; reason: "not_eligible" | "not_found" | "unavailable" | "invalid"; message: string };

export async function startCheckoutAction(input: {
  adventureId: string;
  guestCount: number;
}): Promise<StartCheckoutResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: "Please check your reservation details." };
  }
  const { adventureId, guestCount } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.role !== "member") {
    return { ok: false, reason: "not_eligible", message: "Sign in as a member to reserve." };
  }

  const adventure = await getPublicAdventure(supabase, adventureId);
  if (!adventure) {
    return { ok: false, reason: "not_found", message: "This adventure is no longer available." };
  }
  if (adventure.comingSoon || adventure.isSoldOut) {
    return { ok: false, reason: "unavailable", message: "This adventure isn't open for reservations." };
  }
  if (adventure.paymentMode === "inquire") {
    return { ok: false, reason: "invalid", message: "This adventure is reserved by request — use Request to reserve." };
  }
  if (guestCount > adventure.pricing.maxGuestsPerRsvp) {
    return { ok: false, reason: "invalid", message: "That's more guests than this experience allows." };
  }

  // Active membership at this adventure's property.
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("status", "active")
    .eq("property_id", adventure.propertyId)
    .limit(1);
  const membershipId = memberships?.[0]?.id;
  if (!membershipId) {
    return {
      ok: false,
      reason: "not_eligible",
      message: `This adventure is reserved for members of ${adventure.propertyName}.`,
    };
  }

  const { data: personId } = await supabase.rpc("current_person_id");
  if (!personId) {
    return { ok: false, reason: "not_eligible", message: "We couldn't find your member profile." };
  }

  const admin = createServiceRoleClient();
  const stripe = createStripeClient();
  return startAdventureCheckout(admin, stripe, {
    adventure: {
      id: adventure.id,
      title: adventure.title,
      price: adventure.pricing.price,
      guestPrice: adventure.pricing.guestPrice,
      maxGuestsPerRsvp: adventure.pricing.maxGuestsPerRsvp,
      paymentMode: adventure.paymentMode,
      depositAmount: adventure.depositAmount,
    },
    membershipId,
    personId: personId as string,
    guestCount,
  });
}

// Inquire-mode "request to reserve" — no online payment. Inserts a
// no-capacity `requested` lead (staff confirm availability with the
// outfitter, then convert it) and notifies the property inbox.
export async function requestAdventureAction(input: {
  adventureId: string;
  guestCount: number;
}): Promise<{ ok: boolean; message?: string }> {
  const parsed = z
    .object({ adventureId: z.string().uuid(), guestCount: z.number().int().positive().max(50) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check your request details." };
  const { adventureId, guestCount } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.role !== "member") {
    return { ok: false, message: "Sign in as a member to request." };
  }

  const adventure = await getPublicAdventure(supabase, adventureId);
  if (!adventure) return { ok: false, message: "This adventure is no longer available." };

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("status", "active")
    .eq("property_id", adventure.propertyId)
    .limit(1);
  const membershipId = memberships?.[0]?.id;
  if (!membershipId) {
    return { ok: false, message: `This adventure is reserved for members of ${adventure.propertyName}.` };
  }

  const { data: personId } = await supabase.rpc("current_person_id");
  if (!personId) return { ok: false, message: "We couldn't find your member profile." };

  const admin = createServiceRoleClient();
  const { data: existing } = await admin
    .from("member_adventure_rsvps")
    .select("id, status")
    .eq("adventure_id", adventureId)
    .eq("membership_id", membershipId)
    .maybeSingle();

  if (existing?.status === "confirmed") return { ok: true }; // already going

  let rsvpId: string;
  if (existing) {
    const { error } = await admin
      .from("member_adventure_rsvps")
      .update({ status: "requested", guest_count: guestCount, created_by_person_id: personId as string })
      .eq("id", existing.id);
    if (error) return { ok: false, message: "Couldn't send your request. Try again." };
    rsvpId = existing.id;
  } else {
    const { data: inserted, error } = await admin
      .from("member_adventure_rsvps")
      .insert({
        adventure_id: adventureId,
        membership_id: membershipId,
        created_by_person_id: personId as string,
        guest_count: guestCount,
        status: "requested",
      })
      .select("id")
      .single();
    if (error || !inserted) return { ok: false, message: "Couldn't send your request. Try again." };
    rsvpId = inserted.id;
  }

  const { data: person } = await admin
    .from("people")
    .select("first_name, last_name")
    .eq("id", personId as string)
    .single();
  const guestName =
    `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "A member";

  after(async () => {
    try {
      await inngest.send({
        id: `adventure-${rsvpId}-requested`,
        name: adventureRequested.name,
        data: {
          rsvpId,
          adventureId,
          adventureTitle: adventure.title,
          propertyId: adventure.propertyId,
          propertyName: adventure.propertyName,
          guestName,
          guestCount,
        },
      });
    } catch (err) {
      console.error("[adventures] requested event send failed", err);
    }
  });

  revalidatePath("/member/adventures");
  return { ok: true };
}

// Releases the caller's own pending hold the moment their countdown ends —
// freeing the slot for other members immediately (the cron sweep is just
// the backstop for closed tabs). RLS scopes the lookup to the member's own
// RSVPs; the service role does the cancel. Idempotent + status-guarded, so
// it never clobbers a hold the webhook already confirmed.
export async function releaseAdventureHoldAction(input: {
  adventureId: string;
}): Promise<{ ok: boolean; released: boolean }> {
  const parsed = z.object({ adventureId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, released: false };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.role !== "member") return { ok: false, released: false };

  // RLS (rsvps: member read own) ensures this only finds the caller's hold.
  const { data: rows } = await supabase
    .from("member_adventure_rsvps")
    .select("id")
    .eq("adventure_id", parsed.data.adventureId)
    .eq("status", "pending_payment")
    .limit(1);
  const rsvpId = rows?.[0]?.id;
  if (!rsvpId) return { ok: true, released: false };

  const admin = createServiceRoleClient();
  const { data: released } = await admin
    .from("member_adventure_rsvps")
    .update({ status: "cancelled" })
    .eq("id", rsvpId)
    .eq("status", "pending_payment")
    .select("id");

  revalidatePath("/member/adventures");
  return { ok: true, released: (released?.length ?? 0) > 0 };
}

// Join the waitlist for a sold-out adventure — no payment, no capacity
// hold. Members are emailed to claim when a spot opens (first come).
export async function joinWaitlistAction(input: {
  adventureId: string;
  guestCount: number;
}): Promise<{ ok: boolean; message?: string }> {
  const parsed = z
    .object({ adventureId: z.string().uuid(), guestCount: z.number().int().positive().max(50) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check your details." };
  const { adventureId, guestCount } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.role !== "member") {
    return { ok: false, message: "Sign in as a member to join the waitlist." };
  }

  const adventure = await getPublicAdventure(supabase, adventureId);
  if (!adventure) return { ok: false, message: "This adventure is no longer available." };

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("status", "active")
    .eq("property_id", adventure.propertyId)
    .limit(1);
  const membershipId = memberships?.[0]?.id;
  if (!membershipId) {
    return { ok: false, message: `This adventure is reserved for members of ${adventure.propertyName}.` };
  }

  const { data: personId } = await supabase.rpc("current_person_id");
  if (!personId) return { ok: false, message: "We couldn't find your member profile." };

  const admin = createServiceRoleClient();
  const { data: existing } = await admin
    .from("member_adventure_rsvps")
    .select("id, status")
    .eq("adventure_id", adventureId)
    .eq("membership_id", membershipId)
    .maybeSingle();

  if (existing?.status === "confirmed") {
    return { ok: false, message: "You're already going on this adventure." };
  }
  if (existing?.status === "waitlisted") return { ok: true }; // already queued

  const nowIso = new Date().toISOString();
  const row = {
    status: "waitlisted" as const,
    guest_count: guestCount,
    created_by_person_id: personId as string,
    waitlisted_at: nowIso,
  };
  const { error } = existing
    ? await admin.from("member_adventure_rsvps").update(row).eq("id", existing.id)
    : await admin
        .from("member_adventure_rsvps")
        .insert({ adventure_id: adventureId, membership_id: membershipId, ...row });
  if (error) {
    return { ok: false, message: "Couldn't join the waitlist — that may be more guests than allowed." };
  }

  revalidatePath("/member/adventures");
  revalidatePath(`/adventures/${adventureId}`);
  return { ok: true };
}

// Save the member's guest manifest (names of the additional guests in
// their party) for one of their own RSVPs. Verifies the caller owns the
// RSVP (RLS read), then writes via service role. The service caps the list
// to the party size; blanks are dropped.
export async function saveGuestManifestAction(input: {
  rsvpId: string;
  names: string[];
}): Promise<{ ok: boolean; message?: string }> {
  const parsed = z
    .object({
      rsvpId: z.string().uuid(),
      names: z.array(z.string().max(120)).max(50),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please check the guest names." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.role !== "member") {
    return { ok: false, message: "Sign in to update your guests." };
  }
  // RLS (rsvps: member read own) ensures this only matches the caller's own.
  const { data: owned } = await supabase
    .from("member_adventure_rsvps")
    .select("id")
    .eq("id", parsed.data.rsvpId)
    .maybeSingle();
  if (!owned) return { ok: false, message: "We couldn't find that reservation." };

  const admin = createServiceRoleClient();
  const result = await saveGuestManifest(admin, parsed.data);
  if (!result.ok) return { ok: false, message: "Couldn't save your guests — try again." };

  revalidatePath("/member/adventures");
  return { ok: true };
}

// Member self-cancel of a confirmed RSVP — windowed refund per the
// adventure's free_cancellation_days. Frees the spot regardless.
export async function cancelMyAdventureRsvpAction(rsvpId: string): Promise<{
  ok: boolean;
  message?: string;
  refunded?: boolean;
  refundAmount?: number;
  forfeited?: boolean;
}> {
  const parsed = z.string().uuid().safeParse(rsvpId);
  if (!parsed.success) return { ok: false, message: "Invalid reservation." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.app_metadata?.role !== "member") {
    return { ok: false, message: "Sign in to cancel." };
  }
  // RLS (rsvps: member read own) ensures this only matches the caller's own.
  const { data: owned } = await supabase
    .from("member_adventure_rsvps")
    .select("id")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!owned) return { ok: false, message: "We couldn't find that reservation." };

  const admin = createServiceRoleClient();
  const stripe = createStripeClient();
  const result = await cancelAdventureRsvp(admin, stripe, {
    rsvpId: parsed.data,
    refundPolicy: "windowed",
  });
  if (!result.ok) {
    return { ok: false, message: "Couldn't cancel — try again or contact the concierge." };
  }
  revalidatePath("/member/adventures");
  revalidatePath("/adventures");
  return {
    ok: true,
    refunded: result.refunded,
    refundAmount: result.refundAmount,
    forfeited: result.forfeited,
  };
}
