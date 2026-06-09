import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Heading, PageShell } from "@/lib/ui";
import { getMyUpcomingEvents } from "@/src/services/instructors/events";
import { getCurrentInstructor } from "@/src/services/instructors/current-instructor";
import { getInstructorSelfProfile } from "@/src/services/instructors/self-profile";
import { EventCard } from "@/src/components/instructors/event-card";

export const dynamic = "force-dynamic";

// Instructor home: the events you're teaching, soonest first. Read-only, plus a
// nudge to finish the profile (bio + photo) if it's still bare.
export default async function InstructorHome() {
  const supabase = await createServerSupabaseClient();
  const instructor = await getCurrentInstructor(supabase).catch(() => null);
  const profile = instructor
    ? await getInstructorSelfProfile(supabase, instructor.id).catch(() => null)
    : null;
  const profileIncomplete = profile !== null && (!profile.bio || !profile.photoUrl);
  const events = await getMyUpcomingEvents(supabase);

  return (
    <PageShell width="narrow">
      <Heading level={1} size="h2" underline>
        Your gameplan
      </Heading>
      <p className="text-gray font-serif italic text-[15px] mt-2 mb-6">
        Upcoming events you&rsquo;re teaching. Tap one to see the guest, the
        activity, and anything they&rsquo;ve asked for before you meet them.
      </p>

      {profileIncomplete && (
        <Alert variant="info" title="Complete your profile" className="mb-6">
          Add a bio and photo so guests get to know you when they book.{" "}
          <Link href="/instructor/profile" className="underline">
            Finish your profile →
          </Link>
        </Alert>
      )}

      {events.length === 0 ? (
        <p className="text-gray font-serif italic text-[15px]">
          No upcoming events. Anything new on your schedule will show up here.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => (
            <EventCard key={event.bookingId} event={event} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
