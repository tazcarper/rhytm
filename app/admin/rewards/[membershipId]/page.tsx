import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { PropertyPill } from "@/src/components/admin/property-pill";
import { RewardActivityTable } from "@/src/components/admin/reward-activity-table";
import { RewardAdjustForm } from "@/src/components/admin/reward-adjust-form";
import { RewardExpiryForm } from "@/src/components/admin/reward-expiry-form";
import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";
import {
  getRewardAccountSummary,
  getRewardActivity,
} from "@/src/services/rewards/accounts";
import { dollarsForPoints } from "@/src/services/rewards/points";
import { formatPoints, formatRewardDate, toCentralDay } from "@/src/services/rewards/format";
import { formatMoney } from "@/src/services/public/format";
import detail from "@/src/components/admin/member-detail.module.css";

export const dynamic = "force-dynamic";

// One household's rewards: balance, expiry, add/subtract form, full
// history. RLS limits staff to memberships they can see.
export default async function AdminRewardAccountPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const { membershipId } = await params;
  const supabase = await createServerSupabaseClient();

  const [account, activity] = await Promise.all([
    getRewardAccountSummary(supabase, membershipId),
    getRewardActivity(supabase, membershipId, 200),
  ]);
  if (!account) notFound();

  return (
    <PageShell width="xl">
      <div className={detail.header}>
        <AdminBreadcrumb
          segments={[
            { label: "Admin", href: "/admin" },
            { label: "Rewards", href: "/admin/rewards" },
            { label: `#${account.memberNumber}` },
          ]}
        />
        <div className={detail.titleRow}>
          <Heading level={1} size="h2" underline>
            {account.householdName}
          </Heading>
          <PropertyPill name={account.propertyName} slug={account.propertySlug} />
        </div>
        <p className={detail.memberNumber}>Member #{account.memberNumber}</p>
      </div>

      <div className={detail.sections}>
        <Card padding="loose" elevation="soft">
          <div className={detail.sectionHead}>
            <h2 className={detail.sectionTitle}>
              {formatPoints(account.balance)} points
            </h2>
            <span className={detail.sectionCount}>
              ${formatMoney(dollarsForPoints(REWARDS_PROGRAM, account.balance))} in value
            </span>
          </div>
          <p className={detail.emptyNote}>
            {account.expiresAt
              ? account.isExpired
                ? `Expired ${formatRewardDate(account.expiresAt)}. The balance is kept, but it can’t be used until you extend the date.`
                : `Usable until ${formatRewardDate(account.expiresAt)}.`
              : "No activity yet."}{" "}
            Lifetime earned: {formatPoints(account.lifetimeEarned)}.
          </p>
        </Card>

        <Card padding="loose" elevation="soft">
          <div className={detail.sectionHead}>
            <h2 className={detail.sectionTitle}>Add or subtract points</h2>
          </div>
          <RewardAdjustForm membershipId={membershipId} balance={account.balance} />
        </Card>

        <Card padding="loose" elevation="soft">
          <div className={detail.sectionHead}>
            <h2 className={detail.sectionTitle}>Expiration date</h2>
          </div>
          <RewardExpiryForm
            membershipId={membershipId}
            currentExpiresOn={toCentralDay(account.expiresAt)}
          />
        </Card>

        <Card padding="loose" elevation="soft">
          <div className={detail.sectionHead}>
            <h2 className={detail.sectionTitle}>History</h2>
            <span className={detail.sectionCount}>{activity.length}</span>
          </div>
          <RewardActivityTable activity={activity} />
        </Card>
      </div>
    </PageShell>
  );
}
