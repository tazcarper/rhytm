"use client";

import { useBookingFlow } from "@/src/components/public/booking-flow/booking-flow-provider";
import { BOOKING_TYPE_META } from "@/src/constants/public/booking-types";
import { StepConfirmation } from "@/src/components/public/booking-flow/step-confirmation";
import { formatDateLong, formatSlotLabel } from "@/src/services/public/format";

export function DetailsPlaceholder() {
  const { state } = useBookingFlow();
  // Guard ensures these are set; checks here so TS narrows.
  if (!state.bookingType || !state.date || !state.slotStart) return null;

  const meta = BOOKING_TYPE_META[state.bookingType];
  const disciplineCount = state.disciplineSelections?.length ?? 0;
  const showDisciplines =
    state.bookingType !== "host_an_occasion" && disciplineCount > 0;

  const subtitleParts = [
    meta.title,
    formatDateLong(state.date),
    formatSlotLabel(state.slotStart),
  ];
  if (showDisciplines) {
    subtitleParts.push(
      `${disciplineCount} discipline${disciplineCount === 1 ? "" : "s"}`,
    );
  }

  return (
    <StepConfirmation
      eyebrow="So far"
      title="Looking good"
      subtitle={subtitleParts.join(" · ")}
      hint="The guest info form + live price estimate land here in sub-phase 2.5."
    />
  );
}
