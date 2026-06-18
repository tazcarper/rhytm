import { Card } from "@/lib/ui";
import { formatMoneyExact, round2 } from "@/src/services/public/format";
import type {
  PricingEvent,
  PricingEventSource,
} from "@/src/services/admin/pricing-events";
import kv from "./bid-detail.module.css";
import s from "./bid-pricing-history-card.module.css";

// Source-tagged pricing history (Phase 1). A single newest-first timeline of
// every confirmed_price change, tagged so an investigator can always tell which
// mechanism made a change: a manual PricingEditor edit, a per-line override, or
// the automatic comp reversal when an add-on is re-materialized. Line-override
// entries expand to the per-line detail + the admin-only reason. Admin-only
// surface (this card renders only inside /admin).

// One entry per source keeps the tag/label open for extension — a new source
// adds a row here, not another branch in the render. className indexes into the
// CSS module (bid-pricing-history-card.module.css).
const SOURCE_TAGS: Record<PricingEventSource, { label: string; className: string }> = {
  manual: { label: "manual", className: "tagManual" },
  line_override: { label: "line override", className: "tagOverride" },
  auto_reversal: { label: "auto-reversal", className: "tagAuto" },
};

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
  const delta = round2(newTotal - oldTotal);
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
            const tag = SOURCE_TAGS[event.source];
            return (
              <li key={event.id} className={s.entry}>
                <div className={s.entryHead}>
                  <span className={s[tag.className]}>{tag.label}</span>
                  <span className={s.headline}>
                    {event.override ? (
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

                {/* Line-override rows carry the admin-only reason; manual and
                    auto-reversal rows carry a free-text note explaining the
                    change. */}
                {event.override?.reason && (
                  <div className={s.reason}>Reason: {event.override.reason}</div>
                )}
                {!event.override && event.note && (
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
