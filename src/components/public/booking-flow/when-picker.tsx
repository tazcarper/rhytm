"use client";

import { useParams, useRouter } from "next/navigation";
import { Button, Calendar } from "@/lib/ui";
import { useBookingFlow } from "./booking-flow-provider";
import { StepBackLink } from "./step-back-link";
import { BOOKING_TYPE_META } from "@/src/constants/public/booking-types";
import type {
  AvailableSlot,
  SlotsByDayOfWeek,
} from "@/src/services/public/slots";
import { dayOfWeekFromISO } from "@/src/services/public/slots";
import s from "./when-picker.module.css";

interface WhenPickerProps {
  slotsByDayOfWeek: SlotsByDayOfWeek;
  bookingHorizonDays: number;
}

export function WhenPicker({
  slotsByDayOfWeek,
  bookingHorizonDays,
}: WhenPickerProps) {
  const router = useRouter();
  const { property: propertySlug } = useParams<{ property: string }>();
  const { state, setState } = useBookingFlow();

  // Calendar bounds — minDate is the server-rendered "today" at local midnight,
  // maxDate is today + booking_horizon_days. Property-TZ-aware bounds land in
  // the 2.4.x polish pass (currently uses server-local today, close enough for
  // US properties and acceptable per the funnel-state preference).
  const today = startOfDay(new Date());
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + bookingHorizonDays);

  const selectedDate = state.date ? dateFromISO(state.date) : undefined;
  const dayOfWeek =
    state.date !== undefined ? dayOfWeekFromISO(state.date) : null;
  const slotsForDate: ReadonlyArray<AvailableSlot> =
    dayOfWeek !== null ? slotsByDayOfWeek[dayOfWeek] ?? [] : [];

  function handleDateSelect(date: Date | undefined) {
    if (!date) {
      // RDP v10 with mode="single" calls onSelect(undefined) when the user
      // clicks the currently-selected date — treat as "clear my pick".
      setState({ date: undefined, slotStart: undefined });
      return;
    }
    // Any new date invalidates the prior slot choice.
    setState({ date: dateToISO(date), slotStart: undefined });
  }

  function handleSlotPick(slot: AvailableSlot) {
    if (!state.bookingType) return;
    setState({
      slotStart: slot.slotStart,
      durationHours: BOOKING_TYPE_META[state.bookingType].defaultDurationHours,
    });
  }

  const hasSelection =
    state.date !== undefined && state.slotStart !== undefined;
  const backHref =
    state.bookingType === "host_an_occasion"
      ? `/book/${propertySlug}`
      : `/book/${propertySlug}/disciplines`;
  const backLabel =
    state.bookingType === "host_an_occasion"
      ? "Change booking type"
      : "Change disciplines";

  return (
    <>
      <StepBackLink href={backHref} label={backLabel} />

      <div className={s.layout}>
        <div className={s.column}>
          <p className={s.colLabel}>Pick a date</p>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={[{ before: today }, { after: maxDate }]}
            defaultMonth={selectedDate ?? today}
            weekStartsOn={0}
          />
        </div>

        <div className={s.column}>
          <p className={s.colLabel}>Pick a time</p>
          <p className={s.tzNote}>All times in Central Time</p>
          {!selectedDate && (
            <p className={s.empty}>Choose a date first.</p>
          )}
          {selectedDate && slotsForDate.length === 0 && (
            <p className={s.empty}>No times available on this day.</p>
          )}
          {selectedDate && slotsForDate.length > 0 && (
            <ul className={s.slotGrid}>
              {slotsForDate.map((slot) => {
                const selected = state.slotStart === slot.slotStart;
                return (
                  <li key={slot.slotStart}>
                    <button
                      type="button"
                      className={s.slotBtn}
                      data-selected={selected || undefined}
                      onClick={() => handleSlotPick(slot)}
                      aria-pressed={selected}
                    >
                      {slot.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className={s.footer}>
        <p className={s.footerHint}>
          {hasSelection
            ? "Date and time selected."
            : "Pick a date and time to continue."}
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={() => router.push(`/book/${propertySlug}/details`)}
          disabled={!hasSelection}
        >
          Continue →
        </Button>
      </div>
    </>
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
