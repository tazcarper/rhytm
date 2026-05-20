import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicProperties } from "@/src/services/public/properties";
import { Alert, Eyebrow, Heading, PageShell } from "@/lib/ui";
import { PropertyCard } from "@/src/components/public/property-card";
import {
  PROPERTY_COPY,
  PROPERTY_COPY_FALLBACK,
  propertyOrdinal,
} from "@/src/constants/public/property-copy";
import s from "./book.module.css";

export const dynamic = "force-dynamic";

export default async function BookingPropertyPickerPage() {
  const supabase = await createServerSupabaseClient();
  const { data: properties, error } = await getPublicProperties(supabase);

  return (
    <PageShell width="wide" className={s.shell}>
      <header className={s.head}>
        <Eyebrow variant="crest" as="div">
          The Properties
        </Eyebrow>
        <Heading level={1} size="h1" center>
          Where shall we <em>see you?</em>
        </Heading>
        <p className={s.deck}>
          Three properties, three rhythms. Pick the one you want to
          visit and we&rsquo;ll walk you through the rest in under five
          minutes.
        </p>
      </header>

      {error && (
        <Alert variant="error" title="Could not load properties">
          {error.message}
        </Alert>
      )}

      {!error && properties && properties.length === 0 && (
        <Alert variant="warn" title="No properties available">
          The booking flow needs at least one property in{" "}
          <code>public.properties</code>.
        </Alert>
      )}

      {properties && properties.length > 0 && (
        <div className={s.grid}>
          {properties.map((p, i) => {
            const copy = PROPERTY_COPY[p.slug] ?? PROPERTY_COPY_FALLBACK;
            return (
              <PropertyCard
                key={p.id}
                ordinal={propertyOrdinal(i)}
                name={p.name}
                href={`/book/${p.slug}`}
                locale={copy.locale}
                tagline={copy.tagline}
              />
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
