import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicServicesForProperty } from "@/src/services/public/services";
import { Alert, Eyebrow, Heading } from "@/lib/ui";
import { BookingFlowGuard } from "@/src/components/public/booking-flow/booking-flow-guard";
import { DisciplinePicker } from "@/src/components/public/booking-flow/discipline-picker";
import {
  StepPage,
  StepPageHead,
} from "@/src/components/public/booking-flow/step-page";

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

  const { data: services, error } = await getPublicServicesForProperty(
    supabase,
    property.id,
  );

  return (
    <StepPage
      width="wide"
      back={{ href: `/book/${property.slug}`, label: "Change booking type" }}
    >
      <StepPageHead>
        <Eyebrow variant="crest" as="div">
          Step Two
        </Eyebrow>
        <Heading level={1} size="h1">
          Disciplines &amp; Add-Ons
        </Heading>
      </StepPageHead>

      <BookingFlowGuard requires={["bookingType"]}>
        {error && (
          <Alert variant="error" title="Could not load disciplines">
            {error.message}
          </Alert>
        )}

        {!error && (!services || services.length === 0) && (
          <Alert variant="warn" title="Catalog coming soon">
            We&rsquo;re finalizing the discipline list for {property.name}.
            Reach out if you&rsquo;d like to book directly.
          </Alert>
        )}

        {!error && services && services.length > 0 && (
          <DisciplinePicker services={services} />
        )}
      </BookingFlowGuard>
    </StepPage>
  );
}
