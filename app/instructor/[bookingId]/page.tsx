import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PageShell } from "@/lib/ui";
import { getEventGameplan } from "@/src/services/instructors/gameplan";
import { GameplanDetail } from "@/src/components/instructors/gameplan-detail";

export const dynamic = "force-dynamic";

// Full gameplan for one event. RLS scopes the fetch to the instructor's own
// bookings, so an event they aren't assigned to (or a bad id) comes back null
// and 404s — no cross-instructor leakage.
export default async function InstructorGameplanPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const supabase = await createServerSupabaseClient();
  const gameplan = await getEventGameplan(supabase, bookingId);

  if (!gameplan) {
    notFound();
  }

  return (
    <PageShell width="narrow">
      <Link
        href="/instructor"
        className="inline-block text-gray font-sans text-[13px] mb-4 no-underline hover:underline"
      >
        ← All events
      </Link>
      <GameplanDetail gameplan={gameplan} />
    </PageShell>
  );
}
