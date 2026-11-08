import type { RewardActivity } from "@/src/services/rewards/accounts";
import {
  formatRewardDate,
  formatRewardDay,
  formatSignedPoints,
  REWARD_KIND_LABEL,
} from "@/src/services/rewards/format";
import { formatMoney } from "@/src/services/public/format";
import tableStyles from "@/src/components/admin/queue-list.module.css";

// Staff view of a household's full ledger, newest first. Read-only:
// mistakes are fixed by posting a correction, never by editing a row.

export function RewardActivityTable({ activity }: { activity: RewardActivity[] }) {
  if (activity.length === 0) {
    return <p className="text-gray">No points activity yet.</p>;
  }
  return (
    <div className={tableStyles.tableWrap}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Points</th>
            <th>Amount</th>
            <th>Reason</th>
            <th>Entered</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((row) => (
            <tr key={row.id}>
              <td>{formatRewardDay(row.occurredOn)}</td>
              <td>{REWARD_KIND_LABEL[row.kind]}</td>
              <td className={row.points > 0 ? "text-olive font-semibold" : "font-semibold"}>
                {formatSignedPoints(row.points)}
              </td>
              <td>{row.amountUsd === null ? "—" : `$${formatMoney(row.amountUsd)}`}</td>
              <td>{row.reason}</td>
              <td>
                {formatRewardDate(row.createdAt)}
                {row.source === "online_payment" ? " · automatic" : " · staff"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
