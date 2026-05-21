"use client";

import { useParams, useRouter } from "next/navigation";
import { useBookingFlow } from "./booking-flow-provider";
import type { BookingType } from "./booking-flow-types";
import {
  BOOKING_TYPE_META,
  BOOKING_TYPE_ORDER,
} from "@/src/constants/public/booking-types";
import s from "./booking-type-picker.module.css";

export function BookingTypePicker() {
  const router = useRouter();
  const { property: propertySlug } = useParams<{ property: string }>();
  const { state, setState } = useBookingFlow();

  function chooseType(type: BookingType) {
    // Switching to a different type invalidates any prior discipline selections —
    // catalog scope and single/multi-select rules differ per type.
    if (state.bookingType && state.bookingType !== type) {
      setState({ bookingType: type, disciplineSelections: undefined });
    } else {
      setState({ bookingType: type });
    }
    // Host an Occasion takes the property exclusively — no guest-driven
    // discipline selection (Q4 may revise this). Route past /disciplines.
    const nextStep = type === "host_an_occasion" ? "when" : "disciplines";
    router.push(`/book/${propertySlug}/${nextStep}`);
  }

  return (
    <div
      className={s.grid}
      role="group"
      aria-label="Choose what kind of booking"
    >
      {BOOKING_TYPE_ORDER.map((type) => {
        const meta = BOOKING_TYPE_META[type];
        const selected = state.bookingType === type;
        return (
          <button
            key={type}
            type="button"
            className={s.card}
            data-selected={selected || undefined}
            aria-pressed={selected}
            onClick={() => chooseType(type)}
          >
            <div className={s.ordinal}>No. {meta.ordinal}</div>
            <h3 className={s.title}>{meta.title}</h3>
            <p className={s.duration}>{meta.durationLabel}</p>
            <div className={s.rule} />
            <p className={s.description}>{meta.description}</p>
            <ul className={s.bullets}>
              {meta.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {meta.notice && <p className={s.notice}>{meta.notice}</p>}
            <span className={s.cta}>Choose →</span>
          </button>
        );
      })}
    </div>
  );
}
