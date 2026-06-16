"use client";

import { Button } from "@/lib/ui";
import { useBookingFlow } from "./booking-flow-provider";
import { BOOKING_TYPE_META } from "@/src/constants/public/booking-types";
import {
  buildBookingSummary,
  type PricingModel,
} from "@/src/services/public/pricing";
import {
  formatDateLong,
  formatMoney,
  formatSlotLabel,
} from "@/src/services/public/format";
import type { PublicService } from "@/src/services/public/services";
import s from "./booking-summary.module.css";

interface BookingSummaryProps {
  services: ReadonlyArray<PublicService>;
  pricing: PricingModel | null;
  /** Optional Continue / Submit CTA rendered at the bottom of the panel.
   *  When omitted, the panel is read-only (e.g. /details rail next to the
   *  form's own submit button). */
  cta?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

export function BookingSummary({ services, pricing, cta }: BookingSummaryProps) {
  const { state, setState } = useBookingFlow();
  if (!state.bookingType) return null;

  const selections = state.disciplineSelections;
  const guestCount = state.guestCount;
  const juniorGuestCount = Math.min(state.juniorGuestCount, guestCount);
  const adultGuestCount = guestCount - juniorGuestCount;
  const durationHours =
    state.durationHours ?? BOOKING_TYPE_META[state.bookingType].defaultDurationHours;

  const summary = buildBookingSummary({
    bookingType: state.bookingType,
    pricing,
    guestCount,
    juniorGuestCount,
    durationHours,
    selections,
    services,
  });

  const partyLine =
    juniorGuestCount > 0
      ? `${adultGuestCount} ${adultGuestCount === 1 ? "adult" : "adults"} · ${juniorGuestCount} ${juniorGuestCount === 1 ? "junior" : "juniors"}`
      : `${guestCount} ${guestCount === 1 ? "guest" : "guests"}`;

  function removeAddOn(serviceId: string, addOnId: string) {
    setState({
      disciplineSelections: selections.map((d) =>
        d.serviceId === serviceId
          ? { ...d, addOns: d.addOns.filter((a) => a.addOnId !== addOnId) }
          : d,
      ),
    });
  }

  const whenLine = [
    state.date ? formatDateLong(state.date) : null,
    state.slotStart ? `${formatSlotLabel(state.slotStart)} CT` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <aside className={s.box}>
      <p className={s.eyebrow}>Booking Summary</p>

      <div className={s.section}>
        <p className={s.fact}>{BOOKING_TYPE_META[state.bookingType].title}</p>
        <p className={s.factSub}>
          {partyLine}
          {whenLine && ` · ${whenLine}`}
        </p>
      </div>

      {summary.disciplineNames.length > 0 && (
        <div className={s.section}>
          <p className={s.sectionLabel}>Disciplines</p>
          <ul className={s.list}>
            {summary.disciplineNames.map((name) => (
              <li key={name} className={s.listItem}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.addOns.length > 0 && (
        <div className={s.section}>
          <p className={s.sectionLabel}>Add-ons</p>
          <ul className={s.list}>
            {summary.addOns.map((ao) => (
              <li
                key={`${ao.serviceId}-${ao.addOnId}`}
                className={s.addOnLine}
              >
                <span className={s.addOnText}>
                  {ao.name}
                  {ao.quantity > 1 && (
                    <span className={s.addOnQty}> × {ao.quantity}</span>
                  )}
                </span>
                <span className={s.addOnAmount}>
                  ${formatMoney(ao.lineTotal)}
                </span>
                <button
                  type="button"
                  className={s.removeBtn}
                  onClick={() => removeAddOn(ao.serviceId, ao.addOnId)}
                  aria-label={`Remove ${ao.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.guestFeeAmount > 0 && summary.guestFeeLabel && (
        <div className={s.section}>
          <p className={s.sectionLabel}>Per-guest fee</p>
          <div className={s.feeLine}>
            <span className={s.feeText}>{summary.guestFeeLabel}</span>
            <span className={s.feeAmount}>
              ${formatMoney(summary.guestFeeAmount)}
            </span>
          </div>
        </div>
      )}

      <div className={s.divider} />

      <div className={s.total}>
        <p className={s.totalLabel}>Estimate Total</p>
        {summary.isTeamQuoted ? (
          <p className={s.totalAmount}>Team-quoted</p>
        ) : (
          <p className={s.totalAmount}>
            ${formatMoney(summary.estimateTotal ?? 0)}
          </p>
        )}
        <p className={s.totalNote}>
          {summary.isTeamQuoted
            ? "We'll send a custom quote within 24 hours."
            : "The team confirms your final price within 24 hours."}
        </p>
      </div>

      {cta && (
        <Button
          variant="primary"
          size="md"
          onClick={cta.onClick}
          disabled={cta.disabled}
          className={s.cta}
        >
          {cta.label}
        </Button>
      )}
    </aside>
  );
}
