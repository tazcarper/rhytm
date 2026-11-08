import Link from "next/link";
import type { RewardAccountSummary } from "@/src/services/rewards/accounts";
import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";
import { dollarsForPoints } from "@/src/services/rewards/points";
import { formatPoints, formatRewardDate } from "@/src/services/rewards/format";
import { formatMoney } from "@/src/services/public/format";
import { PropertyPill } from "@/src/components/admin/property-pill";
import tableStyles from "@/src/components/admin/queue-list.module.css";

// Household reward accounts for the admin Rewards index. Each row opens
// the account page where staff add or subtract points.

export function RewardAccountsTable({ accounts }: { accounts: RewardAccountSummary[] }) {
  return (
    <div className={tableStyles.tableWrap}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th>Member #</th>
            <th>Household</th>
            <th>Property</th>
            <th>Points</th>
            <th>Value</th>
            <th>Usable until</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.membershipId}>
              <td>
                <Link className="underline" href={`/admin/rewards/${account.membershipId}`}>
                  #{account.memberNumber}
                </Link>
              </td>
              <td>{account.householdName}</td>
              <td>
                <PropertyPill name={account.propertyName} slug={account.propertySlug} />
              </td>
              <td className="font-semibold">{formatPoints(account.balance)}</td>
              <td>${formatMoney(dollarsForPoints(REWARDS_PROGRAM, account.balance))}</td>
              <td>
                {account.expiresAt ? formatRewardDate(account.expiresAt) : "—"}
                {account.isExpired && " (expired)"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
