import { Eyebrow, Heading } from "@/lib/ui";
import { BookingFlowGuard } from "@/src/components/public/booking-flow/booking-flow-guard";
import {
  StepPage,
  StepPageHead,
} from "@/src/components/public/booking-flow/step-page";
import { DetailsPlaceholder } from "./details-placeholder";

export default async function DetailsPage({
  params,
}: {
  params: Promise<{ property: string }>;
}) {
  const { property: slug } = await params;

  return (
    <StepPage
      width="narrow"
      back={{ href: `/book/${slug}/when`, label: "Change date or time" }}
    >
      <StepPageHead>
        <Eyebrow variant="crest" as="div">
          Step Four
        </Eyebrow>
        <Heading level={1} size="h1">
          Your Details
        </Heading>
      </StepPageHead>

      <BookingFlowGuard requires={["bookingType", "date", "slotStart"]}>
        <DetailsPlaceholder />
      </BookingFlowGuard>
    </StepPage>
  );
}
