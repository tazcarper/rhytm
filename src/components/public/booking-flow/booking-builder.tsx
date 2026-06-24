"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { useBookingFlow } from "./booking-flow-provider";
import { GuestSlider } from "./guest-slider";
import { QtyStepper } from "./qty-stepper";
import { StepBackLink } from "./step-back-link";
import { StepProgress } from "./step-progress";
import { BookingSummary } from "./booking-summary";
import { BOOKING_TYPE_META } from "@/src/constants/public/booking-types";
import {
  computeMaxGuestCount,
  hasJuniorPricing,
  type PricingModel,
} from "@/src/services/public/pricing";
import type { SlotsByDayOfWeek } from "@/src/services/public/slots";
import type {
  PublicAddOn,
  PublicService,
} from "@/src/services/public/services";
import {
  DateTimePicker,
  type DateTimePickerValue,
} from "@/src/components/public/scheduling/date-time-picker";
import type { DisciplineSelection } from "./booking-flow-types";
import { AddOnDetailTooltip } from "./add-on-detail-tooltip";
import { AdventureImage } from "@/src/components/public/adventure-image";
import { InstructorWhenStep } from "./instructor-when-step";
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
  // The add-on whose detail tooltip is open, plus the element it anchors to.
  // A short close-timer powers the hover-bridge (moving the pointer from the
  // row onto the tooltip without it closing). `null` = closed.
  const [detail, setDetail] = useState<{
    addOn: PublicAddOn;
    anchor: HTMLElement;
  } | null>(null);
  const detailCloseTimer = useRef<number | null>(null);

  function cancelDetailClose() {
    if (detailCloseTimer.current !== null) {
      window.clearTimeout(detailCloseTimer.current);
      detailCloseTimer.current = null;
    }
  }
  function openDetail(addOn: PublicAddOn, anchor: HTMLElement) {
    cancelDetailClose();
    setDetail({ addOn, anchor });
  }
  function scheduleDetailClose() {
    cancelDetailClose();
    detailCloseTimer.current = window.setTimeout(() => setDetail(null), 140);
  }
  function closeDetailNow() {
    cancelDetailClose();
    setDetail(null);
  }
  function toggleDetail(addOn: PublicAddOn, anchor: HTMLElement) {
    if (detail?.addOn.id === addOn.id) closeDetailNow();
    else openDetail(addOn, anchor);
  }
  // Hover opens on mouse only; tap (touch/pen) and keyboard toggle on click.
  // A `click` is a PointerEvent, so pointerType separates a real mouse from a
  // touch tap — without this, a tap fires mouseenter→open then click→close.
  function handleDetailEnter(
    event: ReactPointerEvent<HTMLElement>,
    addOn: PublicAddOn,
  ) {
    if (event.pointerType === "mouse") openDetail(addOn, event.currentTarget);
  }
  function handleDetailLeave(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") scheduleDetailClose();
  }
  function handleDetailClick(
    event: ReactMouseEvent<HTMLElement>,
    addOn: PublicAddOn,
  ) {
    if ((event.nativeEvent as PointerEvent).pointerType === "mouse") return;
    toggleDetail(addOn, event.currentTarget);
  }
  // Don't leave a pending close-timer firing setState after unmount.
  useEffect(() => () => cancelDetailClose(), []);

  if (!state.bookingType) return null;
  const bookingType = state.bookingType;
  const meta = BOOKING_TYPE_META[bookingType];
  const isHost = bookingType === "host_an_occasion";
  // Instructor-first WHEN step (private lessons today). When set, the standard
  // calendar/slot path below is replaced by <InstructorWhenStep>, which sources
  // availability from the selected instructor's schedule instead.
  const requiresInstructor = meta.requiresInstructor ?? false;

  const selections = state.disciplineSelections;
  const guestCount = state.guestCount;
  const juniorGuestCount = state.juniorGuestCount;
  const maxGuestCount = computeMaxGuestCount(bookingType, pricing);
  // Only offer the junior control where the property actually prices
  // juniors differently (HSB). Host-an-occasion is team-quoted, so the
  // adult/junior split doesn't affect its estimate.
  const showJuniorControl = !isHost && hasJuniorPricing(pricing);

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
    // Clamp to the add-on's admin-set ceiling (the stepper enforces it in the
    // UI too; this is the safety net). Falls back to 1 if not found.
    const ceiling =
      services
        .find((svc) => svc.id === serviceId)
        ?.addOns.find((a) => a.id === addOnId)?.maxQuantity ?? 1;
    const clamped = Math.max(1, Math.min(ceiling, qty));
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
    const nextGuests = Math.max(1, Math.min(maxGuestCount, n));
    // Juniors can never exceed the party size.
    const patch: { guestCount: number; juniorGuestCount?: number } = {
      guestCount: nextGuests,
    };
    if (juniorGuestCount > nextGuests) patch.juniorGuestCount = nextGuests;
    setState(patch);
  }

  function setJuniorCount(n: number) {
    setState({ juniorGuestCount: Math.max(0, Math.min(guestCount, n)) });
  }

  // Re-clamp if the booking type changed and the prior count is now over the
  // new max (e.g., 12-guest visit → 4-guest lesson via back-nav). The base
  // default of 1 is set by BookingFlowProvider, not here. Keep juniors ≤ guests.
  useEffect(() => {
    if (guestCount > maxGuestCount) {
      const next = maxGuestCount;
      setState(
        juniorGuestCount > next
          ? { guestCount: next, juniorGuestCount: next }
          : { guestCount: next },
      );
    }
  }, [guestCount, juniorGuestCount, maxGuestCount, setState]);

  // -------- date + time --------
  // The calendar + live-availability slot grid live in the shared
  // <DateTimePicker>; it owns availability fetching. We mirror its picks into
  // the booking-flow state and stamp the booking-type duration when a concrete
  // slot lands. (A plain handler is fine — DateTimePicker holds the latest
  // onChange in a ref, so it doesn't need this memoized.)
  function handleWhenChange(next: DateTimePickerValue) {
    setState({
      date: next.dateISO,
      slotStart: next.slotStart,
      ...(next.slotStart !== undefined
        ? { durationHours: meta.defaultDurationHours }
        : {}),
    });
  }

  // -------- sub-step gating --------

  const step1Valid = isHost || selections.length > 0;
  const step2Valid = true;
  const step3Valid =
    state.date !== undefined &&
    state.slotStart !== undefined &&
    (!requiresInstructor || state.instructorId != null);
  const stepValid: ReadonlyArray<boolean> = [
    step1Valid,
    step2Valid,
    step3Valid,
  ];

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
          {/* ===== Step 1: Disciplines ===== */}
          {subStep === 1 &&
            (isHost ? (
              <Alert variant="info" title="Exclusive use">
                Host an Occasion books the whole property — disciplines and
                run-of-show are configured by the team after your inquiry. You
                can leave special requests in the next step.
              </Alert>
            ) : (
              <section className={s.section}>
                <header className={s.disciplineHead}>
                  <p className={s.disciplineEyebrow}>
                    {singleSelect ? "Your discipline" : "Your disciplines"}
                  </p>
                  <h2 className={s.disciplineHeadTitle}>
                    {singleSelect
                      ? "Choose Your Discipline"
                      : "Choose Your Disciplines"}
                  </h2>
                  <p className={s.sectionDescription}>
                    {singleSelect
                      ? "Pick the discipline you'd like to learn. Your instructor will tailor the lesson around your selection, and you can layer add-ons like extra ammunition or specialty gear on top."
                      : "Pick the activities you'd like to experience during your visit. Each discipline includes guided instruction and standard equipment; optional add-ons (instructor upgrades, extra ammunition, premium gear) appear once you select a discipline. Combine as many as you like."}
                  </p>
                </header>

                {services.length === 0 ? (
                  <Alert variant="warn" title="Catalog coming soon">
                    We&rsquo;re finalizing the discipline list for this
                    property.
                  </Alert>
                ) : (
                  <div
                    className={s.disciplineList}
                    role="group"
                    aria-label={
                      singleSelect
                        ? "Choose a discipline"
                        : "Choose disciplines"
                    }
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
                          {/* Media occupies its own full-height column so it
                              grows with the card when add-ons reveal. It's a
                              mouse affordance only — the header button is the
                              labeled, keyboard-reachable toggle. */}
                          <button
                            type="button"
                            className={s.disciplineMediaBtn}
                            onClick={() => toggleService(svc.id)}
                            tabIndex={-1}
                            aria-hidden="true"
                          >
                            <span className={s.disciplineMedia}>
                              {svc.imageUrl ? (
                                <AdventureImage
                                  src={svc.imageUrl}
                                  alt=""
                                  sizes="(max-width: 560px) 100vw, 280px"
                                  className={s.disciplineImage}
                                />
                              ) : (
                                <span className={s.disciplinePlaceholder}>
                                  {svc.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </span>
                          </button>

                          <div className={s.disciplineBody}>
                            <button
                              type="button"
                              className={s.disciplineHeader}
                              onClick={() => toggleService(svc.id)}
                              aria-pressed={selected}
                            >
                              <span className={s.disciplineHeaderText}>
                                <span className={s.disciplineTitle}>
                                  {svc.name}
                                </span>
                                {svc.description && (
                                  <span className={s.disciplineDescription}>
                                    {svc.description}
                                  </span>
                                )}
                              </span>
                              <span className={s.mark} aria-hidden="true">
                                {selected && (
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M20 6 9 17l-5-5" />
                                  </svg>
                                )}
                              </span>
                            </button>

                            {svc.addOns.length > 0 && (
                              <div
                                className={s.addOnReveal}
                                data-open={selected || undefined}
                                inert={!selected || undefined}
                              >
                                <div className={s.addOnRevealInner}>
                                  <div className={s.addOnGroup}>
                                    <p className={s.addOnGroupLabel}>
                                      Add-ons (optional)
                                    </p>
                                    <ul className={s.addOnList}>
                                      {svc.addOns.map((addOn) => {
                                        const sel = (
                                          selection?.addOns ?? []
                                        ).find((a) => a.addOnId === addOn.id);
                                        const on = sel !== undefined;
                                        return (
                                          <li
                                            key={addOn.id}
                                            className={s.addOnRow}
                                            data-selected={on || undefined}
                                          >
                                            {/* Select / deselect — the mark is the toggle. */}
                                            <button
                                              type="button"
                                              className={s.addOnSelect}
                                              onClick={() =>
                                                toggleAddOn(svc.id, addOn.id)
                                              }
                                              aria-pressed={on}
                                              aria-label={`${on ? "Remove" : "Add"} ${addOn.name}`}
                                            >
                                              <span
                                                className={s.addOnMark}
                                                aria-hidden="true"
                                              >
                                                {on ? "✓" : "+"}
                                              </span>
                                            </button>

                                            {/* Name only — the tooltip trigger
                                          (hover on desktop, tap on touch) holds
                                          the full title + description. */}
                                            <button
                                              type="button"
                                              className={s.addOnTrigger}
                                              onPointerEnter={(e) =>
                                                handleDetailEnter(e, addOn)
                                              }
                                              onPointerLeave={handleDetailLeave}
                                              onClick={(e) =>
                                                handleDetailClick(e, addOn)
                                              }
                                              aria-haspopup="dialog"
                                              aria-expanded={
                                                detail?.addOn.id === addOn.id
                                              }
                                              aria-label={`About ${addOn.name}`}
                                            >
                                              <span className={s.addOnName}>
                                                {addOn.name}
                                              </span>
                                            </button>

                                            {/* Right end: the quantity stepper
                                          (when selected and more than one is
                                          allowed), then the price, hard-right. */}
                                            <div className={s.addOnEnd}>
                                              {on && addOn.maxQuantity > 1 && (
                                                <span
                                                  className={s.addOnStepperWrap}
                                                >
                                                  <QtyStepper
                                                    size="sm"
                                                    value={sel?.quantity ?? 1}
                                                    min={1}
                                                    max={addOn.maxQuantity}
                                                    onChange={(qty) =>
                                                      setAddOnQuantity(
                                                        svc.id,
                                                        addOn.id,
                                                        qty,
                                                      )
                                                    }
                                                    label={`${addOn.name} quantity`}
                                                  />
                                                </span>
                                              )}
                                              <span className={s.addOnPrice}>
                                                ${addOn.price.toFixed(0)}
                                                {addOn.maxQuantity > 1 && (
                                                  <span
                                                    className={s.addOnPriceUnit}
                                                  >
                                                    {" "}
                                                    each
                                                  </span>
                                                )}
                                              </span>
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}

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

              {showJuniorControl && (
                <div className={s.juniorRow}>
                  <div className={s.juniorText}>
                    <p className={s.juniorLabel}>Juniors (15 &amp; under)</p>
                    <p className={s.juniorHint}>
                      Of your {guestCount}{" "}
                      {guestCount === 1 ? "guest" : "guests"}, how many are 15
                      or under? Juniors are priced at a reduced guest fee.
                    </p>
                  </div>
                  <QtyStepper
                    value={juniorGuestCount}
                    min={0}
                    max={guestCount}
                    onChange={setJuniorCount}
                    label="Junior guest count"
                  />
                </div>
              )}
            </section>
          )}

          {/* ===== Step 3: When ===== */}
          {subStep === 3 &&
            (requiresInstructor ? (
              <InstructorWhenStep
                propertyId={propertyId}
                slotsByDayOfWeek={slotsByDayOfWeek}
                bookingHorizonDays={bookingHorizonDays}
                durationHours={meta.defaultDurationHours}
              />
            ) : (
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

                <DateTimePicker
                  propertyId={propertyId}
                  slotsByDayOfWeek={slotsByDayOfWeek}
                  bookingHorizonDays={bookingHorizonDays}
                  bookingType={bookingType}
                  durationHours={meta.defaultDurationHours}
                  value={{ dateISO: state.date, slotStart: state.slotStart }}
                  onChange={handleWhenChange}
                />
              </section>
            ))}

          {/* ===== Bottom nav ===== */}
          <div
            className={s.stepNav}
            data-align={subStep === 1 ? "end" : undefined}
          >
            {subStep > 1 && (
              <Button variant="secondary" size="md" onClick={handleBack}>
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
          <BookingSummary
            services={services}
            pricing={pricing}
            variant="rail"
            header={
              <StepProgress
                steps={steps}
                current={subStep}
                onJump={handleJump}
                canJumpTo={canJumpTo}
              />
            }
          />
        </div>
      </div>

      <AddOnDetailTooltip
        addOn={detail?.addOn ?? null}
        anchor={detail?.anchor ?? null}
        onClose={closeDetailNow}
        onPointerEnter={cancelDetailClose}
        onPointerLeave={scheduleDetailClose}
      />
    </>
  );
}
