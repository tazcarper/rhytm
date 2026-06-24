import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/auth/portal";
import { getEstimateClubScheduling } from "@/src/services/public/estimate-scheduling";
import { EstimateIntake } from "@/src/components/public/estimate-intake/estimate-intake";

// Public "Request an Estimate" front door — the missing front half of the
// estimate-driven flow. Thin: resolve whether the viewer is staff (so the
// phone-intake/staff mode is offered) and render the client intake. The
// indicative math + form state live in the client component; submission goes
// through the thin server action → the estimates service.

export const dynamic = "force-dynamic";

export default async function RequestEstimatePage() {
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
      clubScheduling={clubScheduling}
    />
  );
}
