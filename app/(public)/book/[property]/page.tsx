import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { Alert, Eyebrow, Heading, PageShell } from "@/lib/ui";
import {
  PROPERTY_COPY,
  PROPERTY_COPY_FALLBACK,
} from "@/src/constants/public/property-copy";
import {
  BOOKING_RESET_PARAM,
  BOOKING_RESET_VALUE,
} from "@/src/components/public/booking-flow/booking-flow-types";
import s from "./property.module.css";

export const dynamic = "force-dynamic";

export default async function BookingPropertyLandingPage({
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
    <PageShell width="narrow" className={s.shell}>
      {wasReset && (
        <Alert variant="info" title="Let's start over">
          Your previous booking progress was cleared. Pick up from here
          &mdash; it&rsquo;ll only take a few minutes.
        </Alert>
      )}

      <header className={s.head}>
        <Eyebrow variant="crest" as="div">
          {copy.locale}
        </Eyebrow>
        <Heading level={1} size="h1">
          {property.name}
        </Heading>
        <p className={s.deck}>{copy.tagline}</p>
      </header>

      <div className={s.placeholder}>
        <p className={s.placeholderLead}>
          The booking-type selector lands here in sub-phase 2.2.
        </p>
        <p className={s.placeholderHint}>
          Property: <code>{property.slug}</code> &middot; Timezone:{" "}
          <code>{property.timezone}</code>
        </p>
      </div>
    </PageShell>
  );
}
