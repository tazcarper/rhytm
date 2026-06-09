import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { Heading, PageShell } from "@/lib/ui";
import { getCurrentInstructor } from "@/src/services/instructors/current-instructor";
import {
  getInstructorSelfProfile,
  getInstructorSelfProperties,
} from "@/src/services/instructors/self-profile";
import { getInstructorSchedule } from "@/src/services/admin/instructor-schedule";
import { InstructorSelfProfileForm } from "@/src/components/instructors/instructor-self-profile-form";
import { InstructorScheduleEditor } from "@/src/components/admin/instructor-schedule-editor";

export const dynamic = "force-dynamic";

// The instructor's own profile + schedule. The proxy already gates /instructor
// to the instructor role; here we resolve which instructor and load their data
// via service role (scoped to their id), then render the self-service editors.
export default async function InstructorProfilePage() {
  const supabase = await createServerSupabaseClient();
  const instructor = await getCurrentInstructor(supabase).catch(() => null);
  if (!instructor) redirect("/instructor");

  const admin = createServiceRoleClient();
  const [profile, properties, schedule] = await Promise.all([
    getInstructorSelfProfile(admin, instructor.id),
    getInstructorSelfProperties(admin, instructor.id),
    getInstructorSchedule(admin, instructor.id),
  ]);
  if (!profile) redirect("/instructor");

  return (
    <PageShell width="wide">
      <Heading level={1} size="h2" underline>
        Your profile
      </Heading>
      <p className="text-gray font-serif italic text-[15px] mt-2 mb-6 max-w-[62ch]">
        Keep your guest-facing details current and set the hours you teach. Guests booking a
        private lesson see your bio and photo, and can only pick times that fit your schedule.
      </p>

      <InstructorSelfProfileForm initial={profile} />

      <div className="mt-12">
        <Heading level={2} size="h3" underline>
          Your schedule
        </Heading>
        <p className="text-gray font-serif italic text-[15px] mt-2 mb-4 max-w-[62ch]">
          Set your weekly hours at each property, plus any time off or one-off availability. These
          drive what guests can book with you.
        </p>
        <InstructorScheduleEditor
          mode="self"
          instructorId={instructor.id}
          properties={properties}
          initialWindows={schedule.windows}
          initialExceptions={schedule.exceptions}
        />
      </div>
    </PageShell>
  );
}
