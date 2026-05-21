"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/lib/ui";
import { useBookingFlow } from "./booking-flow-provider";
import type { DisciplineSelection } from "./booking-flow-types";
import type { PublicService } from "@/src/services/public/services";
import s from "./discipline-picker.module.css";

interface DisciplinePickerProps {
  services: ReadonlyArray<PublicService>;
}

const QUANTITY_MAX = 20;

export function DisciplinePicker({ services }: DisciplinePickerProps) {
  const router = useRouter();
  const { property: propertySlug } = useParams<{ property: string }>();
  const { state, setState } = useBookingFlow();

  // A private lesson is in one discipline; a visit can span several.
  const singleSelect = state.bookingType === "private_lesson";
  const selections = state.disciplineSelections ?? [];
  const selectionByServiceId = new Map(selections.map((d) => [d.serviceId, d]));

  function setSelections(next: ReadonlyArray<DisciplineSelection>) {
    setState({ disciplineSelections: next });
  }

  function toggleService(serviceId: string) {
    const already = selectionByServiceId.has(serviceId);
    if (singleSelect) {
      setSelections(already ? [] : [{ serviceId, addOns: [] }]);
      return;
    }
    setSelections(
      already
        ? selections.filter((d) => d.serviceId !== serviceId)
        : [...selections, { serviceId, addOns: [] }],
    );
  }

  function toggleAddOn(serviceId: string, addOnId: string) {
    setSelections(
      selections.map((d) => {
        if (d.serviceId !== serviceId) return d;
        const has = d.addOns.find((a) => a.addOnId === addOnId);
        return has
          ? { ...d, addOns: d.addOns.filter((a) => a.addOnId !== addOnId) }
          : { ...d, addOns: [...d.addOns, { addOnId, quantity: 1 }] };
      }),
    );
  }

  function setQuantity(serviceId: string, addOnId: string, qty: number) {
    const clamped = Math.max(1, Math.min(QUANTITY_MAX, qty));
    setSelections(
      selections.map((d) => {
        if (d.serviceId !== serviceId) return d;
        return {
          ...d,
          addOns: d.addOns.map((a) =>
            a.addOnId === addOnId ? { addOnId, quantity: clamped } : a,
          ),
        };
      }),
    );
  }

  const hasAnySelection = selections.length > 0;
  const groupLabel = singleSelect ? "Choose a discipline" : "Choose your disciplines";
  const hint = hasAnySelection
    ? selections.length === 1
      ? "1 discipline selected."
      : `${selections.length} disciplines selected.`
    : singleSelect
      ? "Pick a discipline to continue."
      : "Pick one or more disciplines to continue.";

  return (
    <>
      <div className={s.list} role="group" aria-label={groupLabel}>
        {services.map((svc) => {
          const selection = selectionByServiceId.get(svc.id);
          const selected = selection !== undefined;
          return (
            <article
              key={svc.id}
              className={s.card}
              data-selected={selected || undefined}
            >
              <button
                type="button"
                className={s.cardHeader}
                onClick={() => toggleService(svc.id)}
                aria-pressed={selected}
              >
                <div className={s.cardHeaderText}>
                  <h3 className={s.cardTitle}>{svc.name}</h3>
                  {svc.description && (
                    <p className={s.cardDescription}>{svc.description}</p>
                  )}
                </div>
                <span className={s.cardMark} aria-hidden="true">
                  {selected ? "✓" : "+"}
                </span>
              </button>

              {selected && svc.addOns.length > 0 && (
                <div className={s.addOnGroup}>
                  <p className={s.addOnHeader}>Add-ons (optional)</p>
                  <ul className={s.addOnList}>
                    {svc.addOns.map((addOn) => {
                      const sel = selection.addOns.find(
                        (a) => a.addOnId === addOn.id,
                      );
                      const on = sel !== undefined;
                      return (
                        <li
                          key={addOn.id}
                          className={s.addOnRow}
                          data-selected={on || undefined}
                        >
                          <button
                            type="button"
                            className={s.addOnToggle}
                            onClick={() => toggleAddOn(svc.id, addOn.id)}
                            aria-pressed={on}
                          >
                            <span className={s.addOnMark} aria-hidden="true">
                              {on ? "✓" : "+"}
                            </span>
                            <span className={s.addOnBody}>
                              <span className={s.addOnName}>{addOn.name}</span>
                              {addOn.description && (
                                <span className={s.addOnDescription}>
                                  {addOn.description}
                                </span>
                              )}
                            </span>
                            <span className={s.addOnPrice}>
                              ${addOn.price.toFixed(0)}
                            </span>
                          </button>
                          {on && (
                            <QuantityStepper
                              value={sel.quantity}
                              addOnName={addOn.name}
                              onChange={(qty) =>
                                setQuantity(svc.id, addOn.id, qty)
                              }
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className={s.footer}>
        <p className={s.footerHint}>{hint}</p>
        <Button
          variant="primary"
          size="md"
          onClick={() => router.push(`/book/${propertySlug}/when`)}
          disabled={!hasAnySelection}
        >
          Continue →
        </Button>
      </div>
    </>
  );
}

function QuantityStepper({
  value,
  addOnName,
  onChange,
}: {
  value: number;
  addOnName: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className={s.qty}>
      <button
        type="button"
        className={s.qtyBtn}
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label={`Decrease ${addOnName} quantity`}
      >
        −
      </button>
      <span className={s.qtyValue} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={s.qtyBtn}
        onClick={() => onChange(value + 1)}
        disabled={value >= QUANTITY_MAX}
        aria-label={`Increase ${addOnName} quantity`}
      >
        +
      </button>
    </div>
  );
}
