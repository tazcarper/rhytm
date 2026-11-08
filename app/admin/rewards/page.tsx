import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button, Card, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { RewardAccountsTable } from "@/src/components/admin/reward-accounts-table";
import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";
import {
  getOutstandingPointsByProperty,
  listRewardAccounts,
} from "@/src/services/rewards/accounts";
import { dollarsForPoints } from "@/src/services/rewards/points";
import { formatPoints } from "@/src/services/rewards/format";
import { formatMoney } from "@/src/services/public/format";
import formStyles from "@/src/components/admin/form-styles.module.css";
import detail from "@/src/components/admin/member-detail.module.css";
import tableStyles from "@/src/components/admin/queue-list.module.css";

export const dynamic = "force-dynamic";

// Admin Rewards index: find a household by member number or last name,
// see what's owed in points per property. Thin: two service reads.
export default async function AdminRewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() ?? "";
  const supabase = await createServerSupabaseClient();

  const [accounts, outstanding] = await Promise.all([
    listRewardAccounts(supabase, { search }),
    getOutstandingPointsByProperty(supabase),
  ]);

  return (
    <PageShell width="xl">
      <AdminBreadcrumb segments={[{ label: "Admin", href: "/admin" }, { label: "Rewards" }]} />
      <Heading level={1} size="h2" underline>
        Rewards
      </Heading>
      <p className={formStyles.sectionDesc}>
        Members earn {REWARDS_PROGRAM.pointsPerDollar} point per $1 paid;{" "}
        {formatPoints(REWARDS_PROGRAM.redemptionStep)} points = $
        {formatMoney(dollarsForPoints(REWARDS_PROGRAM, REWARDS_PROGRAM.redemptionStep))}. Online
        payments add and use points automatically. Use this page for anything paid or redeemed at
        the property.
      </p>

      <div className="flex flex-col gap-6 mt-6">
        <Card padding="loose" elevation="soft">
          <form className={`${formStyles.row} items-end`} action="/admin/rewards">
            <label className={formStyles.field}>
              <span className={formStyles.label}>Find a household</span>
              <input
                name="q"
                defaultValue={search}
                className={formStyles.input}
                placeholder="Member number or last name"
              />
            </label>
            <Button type="submit">Search</Button>
          </form>
        </Card>

        <Card padding="loose" elevation="soft">
          <div className={detail.sectionHead}>
            <h2 className={detail.sectionTitle}>
              {search ? `Results for “${search}”` : "Recent activity"}
            </h2>
            <span className={detail.sectionCount}>{accounts.length}</span>
          </div>
          {accounts.length === 0 ? (
            <p className={detail.emptyNote}>
              {search
                ? "No active household matches that member number or last name."
                : "No points have been earned yet. Search for a household to add points."}
            </p>
          ) : (
            <RewardAccountsTable accounts={accounts} />
          )}
        </Card>

        <Card padding="loose" elevation="soft">
          <div className={detail.sectionHead}>
            <h2 className={detail.sectionTitle}>Points outstanding</h2>
          </div>
          <p className={formStyles.help}>
            What members could still redeem, at today&rsquo;s point value. Expired points are kept
            on record but can&rsquo;t be used unless staff extend the date.
          </p>
          {outstanding.length === 0 ? (
            <p className={detail.emptyNote}>Nothing outstanding yet.</p>
          ) : (
            <div className={tableStyles.tableWrap}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Usable points</th>
                    <th>Value</th>
                    <th>Expired points</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((row) => (
                    <tr key={row.propertyName}>
                      <td>{row.propertyName}</td>
                      <td>{formatPoints(row.redeemablePoints)}</td>
                      <td>
                        ${formatMoney(dollarsForPoints(REWARDS_PROGRAM, row.redeemablePoints))}
                      </td>
                      <td>{formatPoints(row.expiredPoints)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
