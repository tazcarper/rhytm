"use client";

import { useBookingFlow } from "@/src/components/public/booking-flow/booking-flow-provider";
import { BookingBuilder } from "@/src/components/public/booking-flow/booking-builder";
import type { PricingByBookingType } from "@/src/services/public/pricing";
import type { PublicService } from "@/src/services/public/services";
import type { SlotsByDayOfWeek } from "@/src/services/public/slots";

// Picks the pricing model that matches the current bookingType in context.
// Sits between the server page (which has no access to context) and
// <BookingBuilder> (which needs one resolved PricingModel).
export function BookingBuilderTypeGate({
  services,
  slotsByDayOfWeek,
  pricingByType,
  bookingHorizonDays,
}: {
  services: ReadonlyArray<PublicService>;
  slotsByDayOfWeek: SlotsByDayOfWeek;
  pricingByType: PricingByBookingType;
  bookingHorizonDays: number;
}) {
  const { state } = useBookingFlow();
  if (!state.bookingType) return null;
  const pricing = pricingByType[state.bookingType] ?? null;

  return (
    <BookingBuilder
      services={services}
      slotsByDayOfWeek={slotsByDayOfWeek}
      pricing={pricing}
      bookingHorizonDays={bookingHorizonDays}
    />
  );
}
