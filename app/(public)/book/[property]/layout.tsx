import type { ReactNode } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BookingFlowProvider } from "@/src/components/public/booking-flow/booking-flow-provider";
import type { GuestInfo } from "@/src/components/public/booking-flow/booking-flow-types";

// Mounts the funnel provider. When a member is signed in, prefills
// the guest block with their name + email so they don't re-type for
// self-bookings. They can still overwrite any field (e.g. booking for
// a non-member friend) — prefill is a default, not a lock. Only the
// member role gets prefill; admin/PM/concierge stay anonymous on the
// public funnel since their on-behalf-of flows live elsewhere.
export default async function BookingPropertyLayout({
  children,
}: {
  children: ReactNode;
  params: Promise<{ property: string }>;
}) {
  const initialGuest = await loadMemberPrefill();
  return (
    <BookingFlowProvider initialGuest={initialGuest}>
      {children}
    </BookingFlowProvider>
  );
}

async function loadMemberPrefill(): Promise<Partial<GuestInfo> | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "member") return null;

  const { data: person } = await supabase
    .from("people")
    .select("first_name, last_name, email, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // RLS-allowed under the `people: self read` policy even if the
  // member-people-row hasn't been linked yet — maybeSingle handles
  // the no-row case without throwing.
  const email = person?.email ?? user.email ?? "";
  // Prefer the member's app display name (set on /member/profile) over
  // their first/last name, matching the top bar and bookings list.
  const fullName = person
    ? `${person.first_name} ${person.last_name}`.trim()
    : "";
  const name = person?.display_name?.trim() || fullName;
  if (!email && !name) return null;
  return { name, email };
}
