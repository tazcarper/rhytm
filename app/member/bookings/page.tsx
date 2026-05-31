import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyBookings } from "@/src/services/members/bookings";
import { Eyebrow, Heading, PageShell } from "@/lib/ui";
import { MemberNav } from "@/src/components/members/member-nav";
import { MyBookingsList } from "@/src/components/members/my-bookings-list";

export const dynamic = "force-dynamic";

// /member/bookings — household-scoped bookings list. RLS narrows the
// rows to the caller's household via current_household_user_ids()
// (see supabase/migrations/20260530120000_household_visible_bookings.sql).
// This page is a thin orchestrator: identify the auth user, call the
// service, hand rows to the pure list component. App 3.8 preview-as-
// member mounts the same <MyBookingsList /> against admin-scoped data.
export default async function MyBookingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = user
    ? await getMyBookings(supabase, user.id)
    : { data: [], error: null };

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        Member
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        Your <em>bookings</em>
      </Heading>
      <MemberNav active="bookings" />
      <MyBookingsList bookings={data ?? []} error={error} />
    </PageShell>
  );
}
