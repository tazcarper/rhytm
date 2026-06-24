import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/auth/portal";
import { getEstimateClubScheduling } from "@/src/services/public/estimate-scheduling";
import { EstimateIntake } from "@/src/components/public/estimate-intake/estimate-intake";
import { CLUB_TO_SLUG, type ClubCode } from "@/src/components/public/estimate-intake/rules";

// Club-locked estimate front door. A per-club link
// (/request-estimate/horseshoe-bay, /hog-heaven, /packsaddle) renders the
// same intake as the generic page but with the club fixed and the
// "which club?" picker hidden — no wrong-club mistakes. The club-specific
// rules (HSB members-only, HH facility + catering, Packsaddle Coming Soon)
// already follow from `club`, so they just work.

export const dynamic = "force-dynamic";

// Reverse the slug → ClubCode map once.
function clubFromSlug(slug: string): ClubCode | null {
  const entry = (Object.entries(CLUB_TO_SLUG) as [ClubCode, string][]).find(
    ([, s]) => s === slug,
  );
  return entry ? entry[0] : null;
}

export default async function RequestEstimateClubPage({
  params,
}: {
  params: Promise<{ club: string }>;
}) {
  const { club } = await params;
  const code = clubFromSlug(club);
  if (!code) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  const canUseStaffMode = hasAdminAccess(role);

  const clubScheduling = await getEstimateClubScheduling(supabase);

  return (
    <EstimateIntake
      canUseStaffMode={canUseStaffMode}
      lockedClub={code}
      clubScheduling={clubScheduling}
    />
  );
}
