import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicServicesForProperty } from "@/src/services/public/services";
import { getPublicPricingForProperty } from "@/src/services/public/pricing";
import { Alert, Eyebrow, Heading } from "@/lib/ui";
import { BookingFlowGuard } from "@/src/components/public/booking-flow/booking-flow-guard";
import { DetailsForm } from "@/src/components/public/booking-flow/details-form";
import {
  StepPage,
  StepPageHead,
} from "@/src/components/public/booking-flow/step-page";

export const dynamic = "force-dynamic";

export default async function DetailsPage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, slug);
  if (!property) notFound();

  const [
    { data: services, error: servicesError },
    { data: pricingByType, error: pricingError },
  ] = await Promise.all([
    getPublicServicesForProperty(supabase, property.id),
    getPublicPricingForProperty(property.id),
  ]);

  const firstError = servicesError ?? pricingError;

  return (
    <StepPage width="wide">
      <StepPageHead>
        <Eyebrow variant="crest" as="div">
          Step Three
        </Eyebrow>
        <Heading level={1} size="h1">
          Your Details
        </Heading>
      </StepPageHead>

      <BookingFlowGuard
        requires={["bookingType", "guestCount", "date", "slotStart"]}
      >
        {firstError && (
          <Alert variant="error" title="Could not load this property">
            {firstError.message}
          </Alert>
        )}

        {!firstError && (
          <DetailsForm
            propertyId={property.id}
            services={services ?? []}
            pricingByType={pricingByType ?? {}}
          />
        )}
      </BookingFlowGuard>
    </StepPage>
  );
}
