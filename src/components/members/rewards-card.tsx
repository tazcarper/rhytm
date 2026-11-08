import Link from "next/link";
import { Card, Eyebrow, Heading } from "@/lib/ui";
import { REWARDS_PROGRAM } from "@/src/constants/rewards/program";
import type { MemberRewardsOverview } from "@/src/services/rewards/member-overview";
import { dollarsForPoints } from "@/src/services/rewards/points";
import {
  formatPoints,
  formatRewardDate,
  formatRewardDay,
  formatSignedPoints,
} from "@/src/services/rewards/format";
import { formatMoney } from "@/src/services/public/format";

// One household's rewards on the member profile: balance and its dollar
// value, when the points can be used until, a few things they could put
// the points toward, and recent activity.
export function RewardsCard({ account }: { account: MemberRewardsOverview }) {
  const valueUsd = dollarsForPoints(REWARDS_PROGRAM, account.balance);

  return (
    <Card padding="loose">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <Heading level={3} size="h3">
          {account.propertyName}
        </Heading>
        <span className="font-sans text-[13px] text-gray">
          Member <code className="font-mono text-olive">#{account.memberNumber}</code>
        </span>
      </div>

      <p className="mt-3 mb-0 font-serif text-[32px] leading-none text-olive">
        {formatPoints(account.balance)}{" "}
        <span className="text-[16px] text-gray">points</span>
      </p>
      <p className="mt-2 mb-0 text-[14px] text-gray">
        Worth ${formatMoney(valueUsd)} toward bookings and purchases at {account.propertyName}.{" "}
        {account.expiresAt &&
          (account.isExpired
            ? `These points expired on ${formatRewardDate(account.expiresAt)}. Contact the property to have them reinstated.`
            : `Usable until ${formatRewardDate(account.expiresAt)}. Earning or using points pushes this date out.`)}
      </p>

      {account.suggestions.length > 0 && (
        <div className="mt-5 pt-5 border-t border-rule">
          <Eyebrow as="div" className="mb-2">
            Put your points toward
          </Eyebrow>
          <ul className="m-0 pl-0 list-none flex flex-col gap-2">
            {account.suggestions.map((item) => (
              <li key={item.href} className="text-[14px]">
                <Link href={item.href} className="text-olive underline">
                  {item.title}
                </Link>{" "}
                <span className="text-gray">
                  &middot; ${formatMoney(item.priceUsd)} &middot;{" "}
                  {item.affordable
                    ? "your points cover it"
                    : `${formatPoints(item.pointsShort)} more points to cover it, or use what you have toward it`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {account.balance >= REWARDS_PROGRAM.redemptionStep && !account.isExpired && (
        <p className="mt-4 mb-0 text-[14px] text-gray">
          Use points when you pay a booking deposit online (signed in), or ask staff at check-in.
        </p>
      )}

      <div className="mt-5 pt-5 border-t border-rule">
        <Eyebrow as="div" className="mb-2">
          Recent activity
        </Eyebrow>
        {account.recentActivity.length === 0 ? (
          <p className="m-0 font-serif italic text-[14px] text-gray">
            No points yet. You&rsquo;ll earn {REWARDS_PROGRAM.pointsPerDollar} point for every $1
            you pay.
          </p>
        ) : (
          <ul className="m-0 pl-0 list-none flex flex-col gap-1">
            {account.recentActivity.map((row) => (
              <li key={row.id} className="flex justify-between gap-4 text-[14px]">
                <span className="text-gray">
                  {formatRewardDay(row.occurredOn)} &middot; {row.reason}
                </span>
                <span className={row.points > 0 ? "text-olive font-semibold" : "font-semibold"}>
                  {formatSignedPoints(row.points)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
