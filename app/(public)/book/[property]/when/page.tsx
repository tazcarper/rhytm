import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getSlotsForProperty } from "@/src/services/public/slots";
import { Alert, Eyebrow, Heading } from "@/lib/ui";
import { BookingFlowGuard } from "@/src/components/public/booking-flow/booking-flow-guard";
import { WhenPicker } from "@/src/components/public/booking-flow/when-picker";
import {
  StepPage,
  StepPageHead,
} from "@/src/components/public/booking-flow/step-page";

export const dynamic = "force-dynamic";

export default async function WhenPage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, slug);
  if (!property) notFound();

  const { data: slotsByDayOfWeek, error } = await getSlotsForProperty(
    supabase,
    property.id,
  );

  return (
    <StepPage width="wide">
      <StepPageHead>
        <Eyebrow variant="crest" as="div">
          Step Three
        </Eyebrow>
        <Heading level={1} size="h1">
          When?
        </Heading>
      </StepPageHead>

      <BookingFlowGuard requires={["bookingType"]}>
        {error && (
          <Alert variant="error" title="Could not load times">
            {error.message}
          </Alert>
        )}

        {!error &&
          (!slotsByDayOfWeek ||
            Object.keys(slotsByDayOfWeek).length === 0) && (
            <Alert variant="warn" title="No times configured">
              Operating hours for {property.name} haven&rsquo;t been set
              yet. Reach out if you&rsquo;d like to book directly.
            </Alert>
          )}

        {!error && slotsByDayOfWeek && Object.keys(slotsByDayOfWeek).length > 0 && (
          <WhenPicker
            slotsByDayOfWeek={slotsByDayOfWeek}
            bookingHorizonDays={property.bookingHorizonDays}
          />
        )}
      </BookingFlowGuard>
    </StepPage>
  );
}
