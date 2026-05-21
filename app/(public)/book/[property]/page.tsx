import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { Alert, Eyebrow, Heading } from "@/lib/ui";
import {
  PROPERTY_COPY,
  PROPERTY_COPY_FALLBACK,
} from "@/src/constants/public/property-copy";
import {
  BOOKING_RESET_PARAM,
  BOOKING_RESET_VALUE,
} from "@/src/components/public/booking-flow/booking-flow-types";
import { BookingTypePicker } from "@/src/components/public/booking-flow/booking-type-picker";
import {
  StepPage,
  StepPageHead,
} from "@/src/components/public/booking-flow/step-page";
import s from "./property.module.css";

export const dynamic = "force-dynamic";

export default async function BookingTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ property: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { property: slug } = await params;
  const search = await searchParams;

  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, slug);

  if (!property) {
    notFound();
  }

  const copy = PROPERTY_COPY[property.slug] ?? PROPERTY_COPY_FALLBACK;
  const wasReset = search[BOOKING_RESET_PARAM] === BOOKING_RESET_VALUE;

  return (
    <StepPage
      width="wide"
      back={{ href: "/book", label: "Pick another property" }}
    >
      {wasReset && (
        <Alert variant="info" title="Let's start over">
          Your previous booking progress was cleared. Pick up from here
          &mdash; it&rsquo;ll only take a few minutes.
        </Alert>
      )}

      <StepPageHead>
        <Eyebrow variant="crest" as="div">
          {copy.locale}
        </Eyebrow>
        <Heading level={1} size="h1">
          {property.name}
        </Heading>
        <p className={s.deck}>{copy.tagline}</p>
        <p className={s.prompt}>What kind of visit are you planning?</p>
      </StepPageHead>

      <BookingTypePicker />
    </StepPage>
  );
}
