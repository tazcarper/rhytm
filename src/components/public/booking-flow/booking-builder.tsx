"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Button, Calendar } from "@/lib/ui";
import { useBookingFlow } from "./booking-flow-provider";
import { GuestSlider } from "./guest-slider";
import { QtyStepper } from "./qty-stepper";
import { StepBackLink } from "./step-back-link";
import { StepProgress } from "./step-progress";
import { BookingSummary } from "./booking-summary";
import { BOOKING_TYPE_META } from "@/src/constants/public/booking-types";
import {
  computeMaxGuestCount,
  type PricingModel,
} from "@/src/services/public/pricing";
import {
  dayOfWeekFromISO,
  type AvailableSlot,
  type SlotAvailability,
  type SlotsByDayOfWeek,
} from "@/src/services/public/slots";
import type { PublicService } from "@/src/services/public/services";
import { getSlotAvailabilityAction } from "@/app/(public)/book/[property]/disciplines/availability-action";
import type { DisciplineSelection } from "./booking-flow-types";
import s from "./booking-builder.module.css";

interface BookingBuilderProps {
  propertyId: string;
  services: ReadonlyArray<PublicService>;
  slotsByDayOfWeek: SlotsByDayOfWeek;
  pricing: PricingModel | null;
  bookingHorizonDays: number;
}

type SubStep = 1 | 2 | 3;

// LIVE AVAILABILITY: `slotsByDayOfWeek` is the static skeleton (which slot
// times exist on each weekday). When the guest picks a date we fetch the
// live availability for that specific date via `getSlotAvailabilityAction`
// (SECURITY DEFINER RPC over `bookings`, which the anon funnel can't read
// directly) and grey out slots that are already reserved.

export function BookingBuilder({
  propertyId,
  services,
  slotsByDayOfWeek,
  pricing,
  bookingHorizonDays,
}: BookingBuilderProps) {
  const router = useRouter();
  const { property: propertySlug } = useParams<{ property: string }>();
  const { state, setState } = useBookingFlow();
  const [subStep, setSubStep] = useState<SubStep>(1);
  // Live per-slot availability for the currently selected date. `null` means
  // "not loaded yet / failed" → readers fail open and treat every slot as
  // bookable, leaving the Phase 2 insert triggers as the final guard.
  const [availability, setAvailability] = useState<SlotAvailability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  if (!state.bookingType) return null;
  const bookingType = state.bookingType;
  const meta = BOOKING_TYPE_META[bookingType];
  const isHost = bookingType === "host_an_occasion";

  const selections = state.disciplineSelections;
  const guestCount = state.guestCount;
  const maxGuestCount = computeMaxGuestCount(bookingType, pricing);

  // -------- discipline & add-on edits --------

  const singleSelect = bookingType === "private_lesson";
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

  function setAddOnQuantity(serviceId: string, addOnId: string, qty: number) {
    const clamped = Math.max(1, Math.min(20, qty));
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

  // -------- guest count --------

  function setGuestCount(n: number) {
    setState({ guestCount: Math.max(1, Math.min(maxGuestCount, n)) });
  }

  // Re-clamp if the booking type changed and the prior count is now over the
  // new max (e.g., 12-guest visit → 4-guest lesson via back-nav). The base
  // default of 1 is set by BookingFlowProvider, not here.
  useEffect(() => {
    if (guestCount > maxGuestCount) {
      setState({ guestCount: maxGuestCount });
    }
  }, [guestCount, maxGuestCount, setState]);

  // -------- date + time --------

  const today = startOfDay(new Date());
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + bookingHorizonDays);

  const selectedDate = state.date ? dateFromISO(state.date) : undefined;
  const dayOfWeek =
    state.date !== undefined ? dayOfWeekFromISO(state.date) : null;
  const slotsForDate: ReadonlyArray<AvailableSlot> =
    dayOfWeek !== null ? slotsByDayOfWeek[dayOfWeek] ?? [] : [];

  // Prospective duration for the availability query — the same value
  // handleSlotPick writes to state, so the overlap window we preview matches
  // the booking we'd create.
  const prospectiveDuration = meta.defaultDurationHours;

  // Fetch live availability whenever the selected date (or the booking shape
  // that defines the overlap window) changes. A stale-guard flag drops
  // out-of-order responses if the guest clicks dates quickly.
  const selectedDateISO = state.date;
  useEffect(() => {
    if (selectedDateISO === undefined) {
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
      durationHours: prospectiveDuration,
    })
      .then((result) => {
        if (!active) return;
        setAvailability(result);
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [propertyId, selectedDateISO, bookingType, prospectiveDuration]);

  // If the slot the guest already picked is now reserved, drop it so they
  // can't advance with a dead selection.
  useEffect(() => {
    if (
      state.slotStart !== undefined &&
      availability !== null &&
      availability[state.slotStart] === false
    ) {
      setState({ slotStart: undefined });
    }
  }, [availability, state.slotStart, setState]);

  function handleDateSelect(date: Date | undefined) {
    if (!date) {
      setState({ date: undefined, slotStart: undefined });
      return;
    }
    setState({ date: dateToISO(date), slotStart: undefined });
  }

  // Slots absent from the map (or before it loads) fail open as available.
  function isSlotAvailable(slot: AvailableSlot): boolean {
    if (availability === null) return true;
    return availability[slot.slotStart] !== false;
  }

  function handleSlotPick(slot: AvailableSlot) {
    if (!isSlotAvailable(slot)) return;
    setState({
      slotStart: slot.slotStart,
      durationHours: meta.defaultDurationHours,
    });
  }

  // -------- sub-step gating --------

  const step1Valid = isHost || selections.length > 0;
  const step2Valid = true;
  const step3Valid = state.date !== undefined && state.slotStart !== undefined;
  const stepValid: ReadonlyArray<boolean> = [step1Valid, step2Valid, step3Valid];

  function canJumpTo(target: number): boolean {
    if (target === subStep) return true;
    if (target < subStep) return true;
    // Forward jump: all prior steps must be valid.
    for (let i = 1; i < target; i++) {
      if (!stepValid[i - 1]) return false;
    }
    return true;
  }

  function handleJump(target: number) {
    if (!canJumpTo(target)) return;
    setSubStep(target as SubStep);
  }

  function handleBack() {
    if (subStep === 1) return;
    setSubStep((subStep - 1) as SubStep);
  }

  function handleNext() {
    if (!stepValid[subStep - 1]) return;
    if (subStep === 3) {
      router.push(`/book/${propertySlug}/details`);
      return;
    }
    setSubStep((subStep + 1) as SubStep);
  }

  // -------- host-an-occasion bypass --------
  // Host bookings skip the disciplines step entirely — copy the user past
  // step 1 so the progress bar / Back button can't strand them on an empty
  // "Exclusive use" notice.
  useEffect(() => {
    if (isHost && subStep === 1) setSubStep(2);
  }, [isHost, subStep]);

  const steps = [
    { label: "Disciplines", isComplete: step1Valid },
    { label: "Guests", isComplete: step2Valid },
    { label: "When", isComplete: step3Valid },
  ];

  const nextLabel = subStep === 3 ? "Continue →" : "Next →";
  const nextDisabled = !stepValid[subStep - 1];

  return (
    <>
      <StepBackLink
        href={`/book/${propertySlug}`}
        label="Change booking type"
      />

      <div className={s.layout}>
        <div className={s.builderColumn}>
          <StepProgress
            steps={steps}
            current={subStep}
            onJump={handleJump}
            canJumpTo={canJumpTo}
          />

          {/* ===== Step 1: Disciplines ===== */}
          {subStep === 1 && (
            isHost ? (
              <Alert variant="info" title="Exclusive use">
                Host an Occasion books the whole property — disciplines and
                run-of-show are configured by the team after your inquiry. You
                can leave special requests in the next step.
              </Alert>
            ) : (
              <section className={s.section}>
                <header className={s.sectionHead}>
                  <p className={s.sectionEyebrow}>
                    {singleSelect ? "Choose your discipline" : "Disciplines & add-ons"}
                  </p>
                  <p className={s.sectionDescription}>
                    {singleSelect
                      ? "Pick the discipline you'd like to learn. Your instructor will tailor the lesson around your selection, and you can layer add-ons like extra ammunition or specialty gear on top."
                      : "Pick the activities you'd like to experience during your visit. Each discipline includes guided instruction and standard equipment; optional add-ons (instructor upgrades, extra ammunition, premium gear) appear once you select a discipline. Combine as many as you like."}
                  </p>
                </header>

                {services.length === 0 ? (
                  <Alert variant="warn" title="Catalog coming soon">
                    We&rsquo;re finalizing the discipline list for this property.
                  </Alert>
                ) : (
                  <div
                    className={s.disciplineList}
                    role="group"
                    aria-label={singleSelect ? "Choose a discipline" : "Choose disciplines"}
                  >
                    {services.map((svc) => {
                      const selection = selectionByServiceId.get(svc.id);
                      const selected = selection !== undefined;
                      return (
                        <article
                          key={svc.id}
                          className={s.disciplineCard}
                          data-selected={selected || undefined}
                        >
                          <button
                            type="button"
                            className={s.disciplineHeader}
                            onClick={() => toggleService(svc.id)}
                            aria-pressed={selected}
                          >
                            <div className={s.disciplineHeaderText}>
                              <h3 className={s.disciplineTitle}>{svc.name}</h3>
                              {svc.description && (
                                <p className={s.disciplineDescription}>
                                  {svc.description}
                                </p>
                              )}
                            </div>
                            <span className={s.mark} aria-hidden="true">
                              {selected ? "✓" : "+"}
                            </span>
                          </button>

                          {selected && svc.addOns.length > 0 && (
                            <div className={s.addOnGroup}>
                              <p className={s.addOnGroupLabel}>Add-ons (optional)</p>
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
                                          <span className={s.addOnName}>
                                            {addOn.name}
                                          </span>
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
                                        <QtyStepper
                                          value={sel.quantity}
                                          onChange={(qty) =>
                                            setAddOnQuantity(svc.id, addOn.id, qty)
                                          }
                                          label={`${addOn.name} quantity`}
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
                )}
              </section>
            )
          )}

          {/* ===== Step 2: Guests ===== */}
          {subStep === 2 && (
            <section className={s.section}>
              <header className={s.sectionHead}>
                <p className={s.sectionEyebrow}>How many guests?</p>
                <p className={s.sectionDescription}>
                  Slide to set the size of your party. Pricing tiers and
                  per-person fees adjust automatically — you&rsquo;ll see the
                  updated estimate in the summary on the right. Up to{" "}
                  {maxGuestCount} guests for this booking type; the team can
                  accommodate larger groups by special arrangement.
                </p>
              </header>
              <GuestSlider
                value={guestCount}
                min={1}
                max={maxGuestCount}
                onChange={setGuestCount}
                label="Guest count"
              />
            </section>
          )}

          {/* ===== Step 3: When ===== */}
          {subStep === 3 && (
            <section className={s.section}>
              <header className={s.sectionHead}>
                <p className={s.sectionEyebrow}>Pick a date & time</p>
                <p className={s.sectionDescription}>
                  Choose the day and arrival time that works best for your
                  group. Available dates run through the next{" "}
                  {bookingHorizonDays} days. Bookings inside 24 hours are
                  reviewed by the team and confirmed by phone. All times shown
                  in Central Time.
                </p>
              </header>

              <div className={s.dateTimeLayout}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={[{ before: today }, { after: maxDate }]}
                  defaultMonth={selectedDate ?? today}
                  weekStartsOn={0}
                />

                <div className={s.slotColumn}>
                  <p className={s.slotColumnLabel}>Pick a time</p>
                  {!selectedDate && (
                    <p className={s.slotEmpty}>Choose a date first.</p>
                  )}
                  {selectedDate && slotsForDate.length === 0 && (
                    <p className={s.slotEmpty}>No times available on this day.</p>
                  )}
                  {selectedDate &&
                    slotsForDate.length > 0 &&
                    availability !== null &&
                    slotsForDate.every((slot) => !isSlotAvailable(slot)) && (
                      <p className={s.slotEmpty}>
                        Every time on this day is reserved — please choose
                        another date.
                      </p>
                    )}
                  {selectedDate && slotsForDate.length > 0 && (
                    <ul
                      className={s.slotGrid}
                      aria-busy={availabilityLoading || undefined}
                    >
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
                              aria-label={
                                available
                                  ? slot.label
                                  : `${slot.label} — reserved`
                              }
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
            </section>
          )}

          {/* ===== Bottom nav ===== */}
          <div className={s.stepNav} data-align={subStep === 1 ? "end" : undefined}>
            {subStep > 1 && (
              <Button
                variant="secondary"
                size="md"
                onClick={handleBack}
              >
                ← Back
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={handleNext}
              disabled={nextDisabled}
            >
              {nextLabel}
            </Button>
          </div>
        </div>

        <div className={s.summaryColumn}>
          <BookingSummary services={services} pricing={pricing} />
        </div>
      </div>
    </>
  );
}

// -------- date helpers (shared with the deleted WhenPicker; inline here) --------

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}
