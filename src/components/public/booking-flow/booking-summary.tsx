"use client";

import type { ReactNode } from "react";
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
  /** Panel framing. `rail` is the full-height sticky "Heritage Ledger" sidebar
   *  used on the builder; `card` (default) is a self-contained bordered card for
   *  contexts like the /details rail next to the guest form. */
  variant?: "rail" | "card";
  /** Optional content rendered at the very top of the ledger panel, above the
   *  "Booking Summary" eyebrow — used by the builder to seat the step progress
   *  stepper inside the sidebar. */
  header?: ReactNode;
  /** Optional Continue / Submit CTA rendered at the bottom of the panel.
   *  When omitted, the panel is read-only (e.g. /details rail next to the
   *  form's own submit button). */
  cta?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

export function BookingSummary({
  services,
  pricing,
  variant = "card",
  header,
  cta,
}: BookingSummaryProps) {
  const { state, setState } = useBookingFlow();
  if (!state.bookingType) return null;

  const selections = state.disciplineSelections;
  const guestCount = state.guestCount;
  const juniorGuestCount = Math.min(state.juniorGuestCount, guestCount);
  const adultGuestCount = guestCount - juniorGuestCount;
  const durationHours =
    state.durationHours ??
    BOOKING_TYPE_META[state.bookingType].defaultDurationHours;

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
    <aside className={`${s.box} ${s[variant]}`}>
      {header && <div className={s.summaryHeader}>{header}</div>}

      <div className={s.intro}>
        <p className={s.eyebrow}>Booking Summary</p>
        <p className={s.fact}>{BOOKING_TYPE_META[state.bookingType].title}</p>
        <p className={s.factSub}>
          {partyLine}
          {whenLine && ` · ${whenLine}`}
        </p>
      </div>

      {/* Ledger entries — dotted-leader rows that grow to fill the panel so the
          subtotal sits at the bottom of the sidebar. */}
      <div className={s.ledger}>
        {summary.disciplineNames.map((name) => (
          <div key={name} className={s.ledgerRow}>
            <span className={s.ledgerLabel}>{name}</span>
            <span className={s.ledgerIncluded}>Included</span>
          </div>
        ))}

        {summary.addOns.map((ao) => (
          <div key={`${ao.serviceId}-${ao.addOnId}`} className={s.ledgerRow}>
            <span className={s.ledgerLabel}>
              {ao.name}
              {ao.quantity > 1 && (
                <span className={s.addOnQty}> × {ao.quantity}</span>
              )}
            </span>
            <span className={s.ledgerAmount}>${formatMoney(ao.lineTotal)}</span>
            <button
              type="button"
              className={s.removeBtn}
              onClick={() => removeAddOn(ao.serviceId, ao.addOnId)}
              aria-label={`Remove ${ao.name}`}
            >
              ×
            </button>
          </div>
        ))}

        {summary.guestFeeAmount > 0 && summary.guestFeeLabel && (
          <div className={s.ledgerRow}>
            <span className={s.ledgerLabel}>{summary.guestFeeLabel}</span>
            <span className={s.ledgerAmount}>
              ${formatMoney(summary.guestFeeAmount)}
            </span>
          </div>
        )}
      </div>

      <div className={s.total}>
        <div className={s.totalRow}>
          <p className={s.totalLabel}>
            {summary.isTeamQuoted ? "Estimate" : "Subtotal"}
          </p>
          {summary.isTeamQuoted ? (
            <p className={s.totalAmountQuoted}>Team-quoted</p>
          ) : (
            <p className={s.totalAmount}>
              ${formatMoney(summary.estimateTotal ?? 0)}
            </p>
          )}
        </div>
        <p className={s.totalNote}>
          {summary.isTeamQuoted
            ? "We'll send a custom quote within 24 hours."
            : "Prices subject to tax and conservation fees. The team confirms your final price within 24 hours."}
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
