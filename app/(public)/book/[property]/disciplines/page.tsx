import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicServicesForProperty } from "@/src/services/public/services";
import { getSlotsForProperty } from "@/src/services/public/slots";
import { getPublicPricingForProperty } from "@/src/services/public/pricing";
import { Alert, Eyebrow, Heading, Text } from "@/lib/ui";
import { BookingFlowGuard } from "@/src/components/public/booking-flow/booking-flow-guard";
import { BookingBuilder } from "@/src/components/public/booking-flow/booking-builder";
import {
  StepPage,
  StepPageHead,
} from "@/src/components/public/booking-flow/step-page";
import { BookingBuilderTypeGate } from "./type-gate";

export const dynamic = "force-dynamic";

export default async function DisciplinesPage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, slug);
  if (!property) notFound();

  // Fetch in parallel — services + slots use the cookie-aware server client,
  // pricing uses service-role; none depend on each other.
  const [
    { data: services, error: servicesError },
    { data: slotsByDayOfWeek, error: slotsError },
    { data: pricingByType, error: pricingError },
  ] = await Promise.all([
    getPublicServicesForProperty(supabase, property.id),
    getSlotsForProperty(supabase, property.id),
    getPublicPricingForProperty(property.id),
  ]);

  const firstError = servicesError ?? slotsError ?? pricingError;

  return (
    <StepPage width="wide">
      <StepPageHead>
        <Eyebrow as="div">Step Two</Eyebrow>
        <Text variant="lead" as="p">
          Build your booking at
        </Text>
        <Heading level={1} size="h1">
          {property.name}
        </Heading>
      </StepPageHead>

      <BookingFlowGuard requires={["bookingType"]}>
        {firstError ? (
          <Alert variant="error" title="Could not load this property">
            {firstError.message}
          </Alert>
        ) : (
          <BookingBuilderTypeGate
            services={services ?? []}
            slotsByDayOfWeek={slotsByDayOfWeek ?? {}}
            pricingByType={pricingByType ?? {}}
            bookingHorizonDays={property.bookingHorizonDays}
          />
        )}
      </BookingFlowGuard>
    </StepPage>
  );
}
