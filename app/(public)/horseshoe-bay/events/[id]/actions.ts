"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const RegisterSchema = z.object({
  eventId: z.string().uuid(),
  contactName: z.string().trim().min(1, "Name is required").max(200),
  contactEmail: z.string().trim().email("Enter a valid email").max(320),
  contactPhone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  guestCount: z.number().int().positive().max(50),
});

export type RegisterForEventInput = z.input<typeof RegisterSchema>;

export type RegisterForEventResult =
  | { ok: true; status: "confirmed" | "waitlisted" }
  | { ok: false; error: string };

// Lives under horseshoe-bay/ but is imported cross-route by the shared
// EventRegistrationForm component, so every property's event detail page
// calls this same action — the property slug is looked up from the event
// row (not assumed) so revalidatePath below hits the right property's
// pages.
//
// Registers a signup for an event. Member pricing eligibility is resolved
// server-side from the caller's own session (active membership at the
// event's property) — never trusted from client input, mirroring the
// pattern in app/(public)/adventures/[id]/reserve/actions.ts. If the
// capacity trigger rejects the confirmed insert (at capacity, or staff
// marked it manually sold out), the registration is retried as
// 'waitlisted' — which the trigger always allows — so the caller gets a
// friendly fallback instead of a raw database error.
export async function registerForEventAction(
  input: RegisterForEventInput,
): Promise<RegisterForEventResult> {
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Please check your details." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: event } = await supabase
    .from("events")
    .select("property_id, member_price, non_member_price, properties ( slug )")
    .eq("id", parsed.data.eventId)
    .maybeSingle();
  if (!event) return { ok: false, error: "This event is no longer available." };

  const propertySlug = event.properties?.[0]?.slug ?? "horseshoe-bay";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isMemberRate = false;
  let personId: string | null = null;

  if (user?.app_metadata?.role === "member") {
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id")
      .eq("status", "active")
      .eq("property_id", event.property_id)
      .limit(1);
    if (memberships && memberships.length > 0) {
      isMemberRate = true;
      const { data: pid } = await supabase.rpc("current_person_id");
      personId = (pid as string | null) ?? null;
    }
  }

  const priceQuoted = isMemberRate ? event.member_price : event.non_member_price;

  const baseRow = {
    event_id: parsed.data.eventId,
    contact_name: parsed.data.contactName,
    contact_email: parsed.data.contactEmail,
    contact_phone: parsed.data.contactPhone,
    person_id: personId,
    is_member_rate: isMemberRate,
    guest_count: parsed.data.guestCount,
    price_quoted: priceQuoted,
  };

  const { error } = await supabase.from("event_registrations").insert({
    ...baseRow,
    status: "confirmed",
  });

  if (error) {
    // The capacity trigger rejects with a message containing "capacity" or
    // "sold-out" — either way, the friendly fallback is the waitlist,
    // which the trigger never blocks.
    const { error: waitlistError } = await supabase.from("event_registrations").insert({
      ...baseRow,
      status: "waitlisted",
    });
    if (waitlistError) {
      return { ok: false, error: "Couldn't join the waitlist — please try again." };
    }
    revalidatePath(`/${propertySlug}/events/${parsed.data.eventId}`);
    return { ok: true, status: "waitlisted" };
  }

  revalidatePath(`/${propertySlug}/events/${parsed.data.eventId}`);
  revalidatePath(`/${propertySlug}/events`);
  return { ok: true, status: "confirmed" };
}
