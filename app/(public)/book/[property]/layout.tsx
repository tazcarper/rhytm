import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/auth/portal";
import { BookingFlowProvider } from "@/src/components/public/booking-flow/booking-flow-provider";
import type { GuestInfo } from "@/src/components/public/booking-flow/booking-flow-types";

// Mounts the funnel provider. When a member is signed in, prefills the guest
// block with their name + email so they don't re-type for self-bookings.
// When a STAFF member is signed in, shows an on-behalf banner instead (no
// prefill — they're entering the customer's details). Everyone else (anon /
// admins-not-booking) gets the plain public funnel.
export default async function BookingPropertyLayout({
  children,
}: {
  children: ReactNode;
  params: Promise<{ property: string }>;
}) {
  // Phase E (request-estimate-bid-integration §10/§12): /request-estimate is now the
  // sole public booking front door. This layout is the chokepoint for the entire
  // /book/[property] funnel subtree (type picker, disciplines, details), so the
  // redirect here hides all of them at once. The funnel code (provider, components,
  // createPublicBooking primitive) is retained for a later deletion task; only the
  // route is made unreachable.
  redirect("/request-estimate");

  const { initialGuest, isStaff } = await loadBookingContext();
  return (
    <BookingFlowProvider initialGuest={initialGuest}>
      {isStaff && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <div className="rounded-card border border-rule bg-paper px-4 py-3 font-serif text-[14px] text-olive leading-[1.5]">
            <strong>Staff booking</strong> — you&rsquo;re booking on behalf of a customer. Enter the{" "}
            <em>customer&rsquo;s</em> name, email, and phone below. They can review, sign, and pay
            from the emailed link, or you can confirm &amp; collect from <strong>Admin → Bids</strong>.
          </div>
        </div>
      )}
      {children}
    </BookingFlowProvider>
  );
}

async function loadBookingContext(): Promise<{
  initialGuest: Partial<GuestInfo> | null;
  isStaff: boolean;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { initialGuest: null, isStaff: false };

  const role = user.app_metadata?.role as string | undefined;

  // Staff booking on behalf of a customer — no prefill, show the banner.
  if (hasAdminAccess(role)) return { initialGuest: null, isStaff: true };

  // Members self-booking — prefill their name + email (overridable).
  if (role === "member") {
    const { data: person } = await supabase
      .from("people")
      .select("first_name, last_name, email, display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const email = person?.email ?? user.email ?? "";
    const fullName = person ? `${person.first_name} ${person.last_name}`.trim() : "";
    const name = person?.display_name?.trim() || fullName;
    if (!email && !name) return { initialGuest: null, isStaff: false };
    return { initialGuest: { name, email }, isStaff: false };
  }

  return { initialGuest: null, isStaff: false };
}
