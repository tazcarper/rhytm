import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/src/services/members/profile";
import { Eyebrow, Heading, PageShell } from "@/lib/ui";
import { MemberNav } from "@/src/components/members/member-nav";
import { ProfileForm } from "@/src/components/members/profile-form";

export const dynamic = "force-dynamic";

// "Profile" tab. Lets the signed-in member edit their display name
// (stored in auth user_metadata, the source of truth for the identity
// strip). Thin orchestrator: fetch the user, read the current display
// name, hand both to the client-side ProfileForm.
export default async function MemberProfilePage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await getMyProfile(supabase, user.id) : null;
  // The form is pre-filled with the current override, or the first
  // name as a starting point if none has been set yet.
  const prefill = profile?.displayName ?? profile?.firstName ?? "";

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        Member
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        Your <em>profile</em>
      </Heading>

      <MemberNav active="profile" />

      <ProfileForm initialDisplayName={prefill} email={user?.email ?? ""} />
    </PageShell>
  );
}
