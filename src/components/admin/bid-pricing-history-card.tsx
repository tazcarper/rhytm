import { Card } from "@/lib/ui";
import { formatMoneyExact } from "@/src/services/public/format";
import type { PricingEvent } from "@/src/services/admin/pricing-events";
import kv from "./bid-detail.module.css";
import s from "./bid-pricing-history-card.module.css";

// Source-tagged pricing history (Phase 1). A single newest-first timeline of
// every confirmed_price change, tagged [manual] or [line override] so an
// investigator can always tell which mechanism made a change. Line-override
// entries expand to the per-line detail + the admin-only reason. Admin-only
// surface (this card renders only inside /admin).

function formatTimestamp(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function signedDelta(oldTotal: number | null, newTotal: number | null): string {
  if (oldTotal === null || newTotal === null) return "";
  const delta = Math.round((newTotal - oldTotal) * 100) / 100;
  const sign = delta >= 0 ? "+" : "−";
  return `${sign}$${formatMoneyExact(Math.abs(delta))}`;
}

export function BidPricingHistoryCard({
  events,
  timezone,
}: {
  events: PricingEvent[];
  timezone: string;
}) {
  return (
    <Card padding="loose" elevation="soft" className={kv.section}>
      <h2 className={kv.sectionTitle}>Pricing history</h2>

      {events.length === 0 ? (
        <p className={s.empty}>No pricing changes on this bid.</p>
      ) : (
        <ul className={s.timeline}>
          {events.map((event) => {
            const isOverride = event.source === "line_override";
            return (
              <li key={event.id} className={s.entry}>
                <div className={s.entryHead}>
                  <span
                    className={isOverride ? s.tagOverride : s.tagManual}
                  >
                    {isOverride ? "line override" : "manual"}
                  </span>
                  <span className={s.headline}>
                    {isOverride && event.override ? (
                      <>
                        {event.override.lineLabel ?? "Line"}{" "}
                        ${formatMoneyExact(event.override.originalAmount)} → $
                        {formatMoneyExact(event.override.newAmount)}
                      </>
                    ) : (
                      <>
                        Quote ${formatMoneyExact(event.oldTotal ?? 0)} → $
                        {formatMoneyExact(event.newTotal ?? 0)}
                      </>
                    )}
                  </span>
                  <span className={s.delta}>
                    {signedDelta(event.oldTotal, event.newTotal)}
                  </span>
                </div>

                <div className={s.meta}>
                  {event.override?.customerFacingLabel && (
                    <span className={s.metaLabel}>
                      “{event.override.customerFacingLabel}” ·{" "}
                    </span>
                  )}
                  {event.actorEmail} · {formatTimestamp(event.createdAt, timezone)}
                </div>

                {isOverride && event.override?.reason && (
                  <div className={s.reason}>Reason: {event.override.reason}</div>
                )}
                {!isOverride && event.note && (
                  <div className={s.reason}>Note: {event.note}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
