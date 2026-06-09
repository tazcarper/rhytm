"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Calendar } from "@/lib/ui";
import { useBookingFlow } from "./booking-flow-provider";
import { startOfDay, dateToISO, dateFromISO } from "./date-utils";
import {
  dayOfWeekFromISO,
  type AvailableSlot,
  type SlotsByDayOfWeek,
} from "@/src/services/public/slots";
import type { QualifiedInstructor } from "@/src/services/public/instructor-availability";
import {
  getQualifiedInstructorsAction,
  getInstructorAvailableDatesAction,
  getInstructorSlotAvailabilityAction,
} from "@/app/(public)/book/[property]/disciplines/instructor-availability-action";
import s from "./booking-builder.module.css";

interface InstructorWhenStepProps {
  propertyId: string;
  slotsByDayOfWeek: SlotsByDayOfWeek;
  bookingHorizonDays: number;
  durationHours: number;
}

// Instructor-first WHEN step: pick a qualified instructor (defaulted to the
// first available one), then a date + time that reflect THAT instructor's
// schedule, bookings (across all properties, travel-buffer-aware), and the
// property's capacity — all computed server-side by the Phase C RPCs. Writes
// instructorId / date / slotStart into the funnel state the same way the
// standard WHEN step writes date / slotStart, so the rest of the funnel (step
// validity, summary, submit) is unchanged.
export function InstructorWhenStep({
  propertyId,
  slotsByDayOfWeek,
  bookingHorizonDays,
  durationHours,
}: InstructorWhenStepProps) {
  const { state, setState } = useBookingFlow();

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => {
    const end = new Date(today);
    end.setDate(end.getDate() + bookingHorizonDays);
    return end;
  }, [today, bookingHorizonDays]);
  const fromISO = dateToISO(today);
  const toISO = dateToISO(maxDate);

  // Stable dependency key for the selected discipline set.
  const serviceIdsKey = state.disciplineSelections
    .map((selection) => selection.serviceId)
    .join(",");

  const [instructors, setInstructors] = useState<QualifiedInstructor[] | null>(null);
  const [instructorsLoading, setInstructorsLoading] = useState(true);
  const [availableDates, setAvailableDates] = useState<Set<string> | null>(null);
  const [slotAvailability, setSlotAvailability] = useState<Record<string, boolean> | null>(
    null,
  );
  const [slotsLoading, setSlotsLoading] = useState(false);

  const selectedInstructorId = state.instructorId ?? null;

  // 1) Load qualified instructors when discipline / duration / property changes.
  useEffect(() => {
    let active = true;
    setInstructorsLoading(true);
    getQualifiedInstructorsAction({
      propertyId,
      serviceIds: serviceIdsKey === "" ? [] : serviceIdsKey.split(","),
      durationHours,
      fromISO,
      toISO,
    })
      .then((result) => {
        if (active) setInstructors(result);
      })
      .finally(() => {
        if (active) setInstructorsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [propertyId, serviceIdsKey, durationHours, fromISO, toISO]);

  // 2) Default-select the first AVAILABLE instructor once the list loads (or
  //    re-default when the current pick isn't in the new list). instructorId is
  //    data-dependent (first-available), so the default lives here, not in
  //    INITIAL_STATE — the sanctioned exception to the display-defaults rule.
  useEffect(() => {
    if (instructors === null) return;
    const instructorIds = new Set(instructors.map((instructor) => instructor.id));
    if (selectedInstructorId !== null && instructorIds.has(selectedInstructorId)) return;
    const firstAvailable =
      instructors.find((instructor) => instructor.nextAvailableDate !== null) ??
      instructors[0] ??
      null;
    setState({
      instructorId: firstAvailable ? firstAvailable.id : null,
      date: undefined,
      slotStart: undefined,
    });
  }, [instructors, selectedInstructorId, setState]);

  // 3) Load the selected instructor's available dates (to enable calendar days).
  useEffect(() => {
    if (selectedInstructorId === null) {
      setAvailableDates(null);
      return;
    }
    let active = true;
    getInstructorAvailableDatesAction({
      instructorId: selectedInstructorId,
      propertyId,
      durationHours,
      fromISO,
      toISO,
    }).then((result) => {
      if (!active) return;
      setAvailableDates(result === null ? null : new Set(result));
    });
    return () => {
      active = false;
    };
  }, [selectedInstructorId, propertyId, durationHours, fromISO, toISO]);

  // 4) Load per-slot availability for the selected instructor + date.
  useEffect(() => {
    if (selectedInstructorId === null || state.date === undefined) {
      setSlotAvailability(null);
      setSlotsLoading(false);
      return;
    }
    let active = true;
    setSlotsLoading(true);
    getInstructorSlotAvailabilityAction({
      instructorId: selectedInstructorId,
      propertyId,
      dateISO: state.date,
      durationHours,
    })
      .then((result) => {
        if (active) setSlotAvailability(result);
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedInstructorId, state.date, propertyId, durationHours]);

  // 5) Drop a picked slot that the latest availability says is taken.
  useEffect(() => {
    if (
      state.slotStart !== undefined &&
      slotAvailability !== null &&
      slotAvailability[state.slotStart] === false
    ) {
      setState({ slotStart: undefined });
    }
  }, [slotAvailability, state.slotStart, setState]);

  function selectInstructor(instructorId: string) {
    if (instructorId === selectedInstructorId) return;
    // Availability differs per instructor — clear the dependent funnel fields
    // and the cached date set so the calendar fails open (rather than showing
    // the previous instructor's days) until effect 3 refetches.
    setAvailableDates(null);
    setState({ instructorId, date: undefined, slotStart: undefined });
  }

  function handleDateSelect(date: Date | undefined) {
    setState({ date: date ? dateToISO(date) : undefined, slotStart: undefined });
  }

  function isSlotAvailable(slot: AvailableSlot): boolean {
    if (slotAvailability === null) return true; // fail open
    return slotAvailability[slot.slotStart] !== false;
  }

  function handleSlotPick(slot: AvailableSlot) {
    if (!isSlotAvailable(slot)) return;
    setState({ slotStart: slot.slotStart, durationHours });
  }

  // A calendar day is disabled if it falls outside the horizon OR the instructor
  // has no opening on it. `availableDates === null` (couldn't compute) fails open.
  function isDateUnavailable(date: Date): boolean {
    if (availableDates === null) return false;
    return !availableDates.has(dateToISO(date));
  }

  const selectedDate = state.date ? dateFromISO(state.date) : undefined;
  const dayOfWeek = state.date !== undefined ? dayOfWeekFromISO(state.date) : null;
  const slotsForDate: ReadonlyArray<AvailableSlot> =
    dayOfWeek !== null ? slotsByDayOfWeek[dayOfWeek] ?? [] : [];

  const noInstructors = instructors !== null && instructors.length === 0;
  const selectedHasNoOpenings = availableDates !== null && availableDates.size === 0;

  return (
    <section className={s.section}>
      <header className={s.sectionHead}>
        <p className={s.sectionEyebrow}>Choose your instructor & time</p>
        <p className={s.sectionDescription}>
          Pick the instructor you&rsquo;d like to work with — we default to the first one
          available. The calendar and times below show when they&rsquo;re free across the
          next {bookingHorizonDays} days. All times shown in Central Time.
        </p>
      </header>

      {instructorsLoading && instructors === null ? (
        <p className={s.slotEmpty}>Finding available instructors…</p>
      ) : noInstructors ? (
        <Alert variant="warn" title="No instructor available">
          No instructor currently offers this discipline at this property. Please contact us
          and we&rsquo;ll arrange a lesson for you.
        </Alert>
      ) : (
        <div
          className={s.instructorPicker}
          role="radiogroup"
          aria-label="Choose your instructor"
        >
          {(instructors ?? []).map((instructor) => {
            const selected = instructor.id === selectedInstructorId;
            const hasAvailability = instructor.nextAvailableDate !== null;
            return (
              <button
                key={instructor.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={s.instructorCard}
                data-selected={selected || undefined}
                data-unavailable={!hasAvailability || undefined}
                onClick={() => selectInstructor(instructor.id)}
              >
                <span className={s.instructorPhoto}>
                  {instructor.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={instructor.photoUrl} alt="" loading="lazy" />
                  ) : (
                    <span className={s.instructorPhotoFallback} aria-hidden="true">
                      {instructor.name.charAt(0)}
                    </span>
                  )}
                </span>
                <span className={s.instructorInfo}>
                  <span className={s.instructorName}>{instructor.name}</span>
                  {instructor.bio && (
                    <span className={s.instructorBio}>{instructor.bio}</span>
                  )}
                  <span className={s.instructorMeta}>
                    {hasAvailability ? "Available" : "No openings in this window"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedInstructorId !== null && (
        <div className={s.dateTimeLayout}>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={[{ before: today }, { after: maxDate }, isDateUnavailable]}
            defaultMonth={selectedDate ?? today}
            weekStartsOn={0}
          />

          <div className={s.slotColumn}>
            <p className={s.slotColumnLabel}>Pick a time</p>
            {selectedHasNoOpenings && (
              <p className={s.slotEmpty}>
                This instructor has no openings in the next {bookingHorizonDays} days — try
                another instructor.
              </p>
            )}
            {!selectedHasNoOpenings && !selectedDate && (
              <p className={s.slotEmpty}>Choose an available date.</p>
            )}
            {selectedDate && slotsForDate.length === 0 && (
              <p className={s.slotEmpty}>No times available on this day.</p>
            )}
            {selectedDate && slotsForDate.length > 0 && (
              <ul className={s.slotGrid} aria-busy={slotsLoading || undefined}>
                {slotsForDate.map((slot) => {
                  const selected = state.slotStart === slot.slotStart;
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
                        aria-label={available ? slot.label : `${slot.label} — unavailable`}
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
      )}
    </section>
  );
}
