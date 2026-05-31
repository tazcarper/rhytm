import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyBookingDetail } from "@/src/services/members/booking-detail";
import { Alert, Eyebrow, Heading, PageShell } from "@/lib/ui";
import { MemberNav } from "@/src/components/members/member-nav";
import { BookingDetailView } from "@/src/components/members/booking-detail-view";

export const dynamic = "force-dynamic";

// /member/bookings/[id] — full detail view of one booking. RLS narrows
// the booking + its children (bid, disciplines, add-ons) to the
// caller's household (see supabase/migrations/
// 20260530160000_household_visible_booking_children.sql). When the row
// isn't visible to the caller — wrong booking id, lapsed membership,
// cross-household — we render a 404.
export default async function MyBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: booking, error } = await getMyBookingDetail(
    supabase,
    id,
    user.id,
  );

  if (!error && !booking) {
    notFound();
  }

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        Member
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        Your <em>trip</em>
      </Heading>
      <MemberNav active="bookings" />

      <div className="mb-4">
        <Link
          href="/member/bookings"
          className="font-serif italic text-tan-deep hover:text-olive text-[14px]"
        >
          ← All bookings
        </Link>
      </div>

      {error && (
        <Alert variant="error" title="Could not load booking">
          {error.message}
        </Alert>
      )}

      {booking && <BookingDetailView booking={booking} />}
    </PageShell>
  );
}
