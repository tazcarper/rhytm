import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/src/services/members/profile";
import { Eyebrow, Heading, PageShell } from "@/lib/ui";
import { MemberNav } from "@/src/components/members/member-nav";
import { ProfileForm } from "@/src/components/members/profile-form";
import { PasswordForm } from "@/src/components/members/password-form";
import { RewardsCard } from "@/src/components/members/rewards-card";
import { REWARDS_PROGRAM, REWARDS_TERMS_PATH } from "@/src/constants/rewards/program";
import { getMyRewardsOverview } from "@/src/services/rewards/member-overview";
import Link from "next/link";

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

  const [profile, rewards] = user
    ? await Promise.all([
        getMyProfile(supabase, user.id),
        getMyRewardsOverview(supabase, REWARDS_PROGRAM),
      ])
    : [null, []];
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

      <Heading level={2} size="h3" className="mt-10">
        Password
      </Heading>
      <p className="text-gray font-serif italic text-[14px] mt-1 mb-0 max-w-md">
        Set a password to sign in directly next time, instead of waiting for an
        emailed link. You can always use the link as a backup.
      </p>
      <PasswordForm />

      {rewards.length > 0 && (
        <>
          <Heading level={2} size="h3" className="mt-10">
            Rewards
          </Heading>
          <p className="text-gray font-serif italic text-[14px] mt-1 mb-4 max-w-md">
            Your household earns {REWARDS_PROGRAM.pointsPerDollar} point for every  you pay.
            Every {REWARDS_PROGRAM.redemptionStep} points is worth $
            {(REWARDS_PROGRAM.redemptionStep * REWARDS_PROGRAM.dollarsPerPoint).toFixed(0)} off.
          </p>
          <div className="flex flex-col gap-4">
            {rewards.map((account) => (
              <RewardsCard key={account.membershipId} account={account} />
            ))}
          </div>
        </>
      )}

      <p className="mt-12 pt-4 border-t border-rule text-[13px] text-gray">
        <Link href={REWARDS_TERMS_PATH} className="underline">
          Rewards program terms
        </Link>
      </p>
    </PageShell>
  );
}
