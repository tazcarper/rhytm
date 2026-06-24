"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/lib/ui";
import {
  dayOfWeekFromISO,
  type AvailableSlot,
  type SlotAvailability,
  type SlotsByDayOfWeek,
} from "@/src/services/public/slots";
import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";
import {
  startOfDay,
  dateToISO,
  dateFromISO,
} from "@/src/components/public/booking-flow/date-utils";
import { getSlotAvailabilityAction } from "./availability-action";
import s from "./date-time-picker.module.css";

export interface DateTimePickerValue {
  // "YYYY-MM-DD" / "HH:MM:SS" — both undefined until picked.
  dateISO?: string;
  slotStart?: string;
}

interface DateTimePickerProps {
  propertyId: string;
  // The static skeleton: which slot times exist on each weekday.
  slotsByDayOfWeek: SlotsByDayOfWeek;
  bookingHorizonDays: number;
  // Shape the overlap window the availability RPC previews, so it matches the
  // booking that would be created.
  bookingType: BookingType;
  durationHours: number;
  // Whether to fetch + show live availability (grey out reserved slots).
  // Defaults true (the funnel's real enforcement). The estimate front door
  // passes false as a TEMPORARY measure: capacity rules (max groups per slot)
  // aren't defined yet, so every configured slot stays selectable and staff
  // confirm availability manually from the admin schedule. Flip back to true
  // (per call site, or via a future DB config) once those rules exist —
  // nothing else about this component changes.
  enforceAvailability?: boolean;
  // Minimum lead time in days before the earliest selectable date. Defaults 0
  // (any day from today). The estimate form raises this to 3 for Private Events
  // (party of 9+), which require 72 hours' advance reservation.
  minLeadDays?: number;
  value: DateTimePickerValue;
  onChange: (next: DateTimePickerValue) => void;
}

// The calendar + live-availability slot grid, lifted out of the /book funnel so
// the estimate front door reuses the identical schedule view. Controlled:
// the parent owns the picked date + slot and gets every change via `onChange`.
// Live availability (reserved slots greyed out) is fetched here per selected
// date; on failure — or when `enforceAvailability` is false — it fails open and
// shows all configured times as selectable.
export function DateTimePicker({
  propertyId,
  slotsByDayOfWeek,
  bookingHorizonDays,
  bookingType,
  durationHours,
  enforceAvailability = true,
  minLeadDays = 0,
  value,
  onChange,
}: DateTimePickerProps) {
  const [availability, setAvailability] = useState<SlotAvailability | null>(
    null,
  );
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Hold the latest onChange so the "drop a now-reserved slot" effect doesn't
  // depend on the parent memoizing its callback (avoids re-fire loops).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const today = startOfDay(new Date());
  // Earliest selectable date — today, pushed out by the minimum lead time
  // (e.g. 3 days for a Private Event's 72-hour notice).
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + Math.max(0, minLeadDays));
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + bookingHorizonDays);

  const selectedDate = value.dateISO ? dateFromISO(value.dateISO) : undefined;
  const dayOfWeek =
    value.dateISO !== undefined ? dayOfWeekFromISO(value.dateISO) : null;
  const slotsForDate: ReadonlyArray<AvailableSlot> =
    dayOfWeek !== null ? (slotsByDayOfWeek[dayOfWeek] ?? []) : [];

  // Fetch live availability whenever the date (or overlap-shaping inputs) change.
  // When enforcement is off, never fetch — availability stays null, which the
  // readers below treat as "all slots available" (fail-open).
  const selectedDateISO = value.dateISO;
  useEffect(() => {
    if (!enforceAvailability || selectedDateISO === undefined) {
      setAvailability(null);
      setAvailabilityLoading(false);
      return;
    }
    let active = true;
    setAvailabilityLoading(true);
    getSlotAvailabilityAction({
      propertyId,
      dateISO: selectedDateISO,
      bookingType,
      durationHours,
    })
      .then((result) => {
        if (active) setAvailability(result);
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    propertyId,
    selectedDateISO,
    bookingType,
    durationHours,
    enforceAvailability,
  ]);

  // If the slot already picked is now reserved, drop it so the parent can't
  // advance / submit a dead selection.
  const pickedSlot = value.slotStart;
  useEffect(() => {
    if (
      pickedSlot !== undefined &&
      availability !== null &&
      availability[pickedSlot] === false
    ) {
      onChangeRef.current({ dateISO: selectedDateISO, slotStart: undefined });
    }
  }, [availability, pickedSlot, selectedDateISO]);

  // If the picked date is now earlier than the minimum lead time (e.g. the
  // party just grew into a Private Event), clear it so a too-soon date can't be
  // submitted — the calendar already disables those days.
  const minTime = minDate.getTime();
  useEffect(() => {
    if (
      selectedDateISO !== undefined &&
      dateFromISO(selectedDateISO).getTime() < minTime
    ) {
      onChangeRef.current({ dateISO: undefined, slotStart: undefined });
    }
  }, [selectedDateISO, minTime]);

  // Slots absent from the map (or before it loads) fail open as available.
  function isSlotAvailable(slot: AvailableSlot): boolean {
    if (availability === null) return true;
    return availability[slot.slotStart] !== false;
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) {
      onChange({ dateISO: undefined, slotStart: undefined });
      return;
    }
    onChange({ dateISO: dateToISO(date), slotStart: undefined });
  }

  function handleSlotPick(slot: AvailableSlot) {
    if (!isSlotAvailable(slot)) return;
    onChange({ dateISO: selectedDateISO, slotStart: slot.slotStart });
  }

  return (
    <div className={s.dateTimeLayout}>
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={handleDateSelect}
        disabled={[{ before: minDate }, { after: maxDate }]}
        defaultMonth={selectedDate ?? minDate}
        weekStartsOn={0}
      />

      <div className={s.slotColumn}>
        <p className={s.slotColumnLabel}>Pick a time</p>
        {!selectedDate && <p className={s.slotEmpty}>Choose a date first.</p>}
        {selectedDate && slotsForDate.length === 0 && (
          <p className={s.slotEmpty}>No times available on this day.</p>
        )}
        {selectedDate &&
          slotsForDate.length > 0 &&
          availability !== null &&
          slotsForDate.every((slot) => !isSlotAvailable(slot)) && (
            <p className={s.slotEmpty}>
              Every time on this day is reserved — please choose another date.
            </p>
          )}
        {selectedDate && slotsForDate.length > 0 && (
          <ul className={s.slotGrid} aria-busy={availabilityLoading || undefined}>
            {slotsForDate.map((slot) => {
              const selected = value.slotStart === slot.slotStart;
              const available = isSlotAvailable(slot);
              return (
                <li key={slot.slotStart}>
                  <button
                    type="button"
                    className={s.slotBtn}
                    data-selected={selected || undefined}
                    data-unavailable={!available || undefined}
                    onClick={() => handleSlotPick(slot)}
                    disabled={!available}
                    aria-pressed={selected}
                    aria-label={available ? slot.label : `${slot.label} — reserved`}
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
  );
}
