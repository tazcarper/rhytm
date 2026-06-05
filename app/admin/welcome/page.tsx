import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Eyebrow, Heading, PageShell } from "@/lib/ui";
import { staffNeedsOnboarding } from "@/src/services/admin/team";
import { StaffWelcomeForm } from "@/src/components/admin/staff-welcome-form";

export const dynamic = "force-dynamic";

// First-sign-in onboarding for staff. The admin layout routes incomplete
// staff here; an already-onboarded user who lands here is sent on.
export default async function WelcomePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await staffNeedsOnboarding(user.id))) {
    redirect("/admin");
  }

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        Welcome to Rhythm Outdoors
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        Set up your <em>profile</em>
      </Heading>
      <div className="mt-6">
        <StaffWelcomeForm email={user.email ?? ""} />
      </div>
    </PageShell>
  );
}
