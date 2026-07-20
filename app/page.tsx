import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicProperties } from "@/src/services/public/properties";
import { Alert, Eyebrow, Heading, PageShell } from "@/lib/ui";
import { PropertyCard } from "@/src/components/public/property-card";
import {
  PROPERTY_COPY,
  PROPERTY_COPY_FALLBACK,
} from "@/src/constants/public/property-copy";
import s from "./page.module.css";

export const dynamic = "force-dynamic";

// Club-selector gateway. Replaced the editorial "/" homepage on 2026-07-19 —
// see src/archive/homepage/legacy-homepage.tsx for the archived version. This
// page's one job is to send a visitor to the right club's own marketing site.
export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: properties, error } = await getPublicProperties(supabase);

  return (
    <div className={s.page}>
      <PageShell width="wide" className={s.shell}>
        <header className={s.head}>
          <Eyebrow variant="crest" as="div">
            Rhythm Outdoors
          </Eyebrow>
          <Heading level={1} size="display" center>
            The <em>Clubs</em>
          </Heading>
          <p className={s.deck}>
            A family of private outdoor and sporting clubs. Choose a club to
            explore.
          </p>
        </header>

        {error && (
          <Alert variant="error" title="Could not load clubs">
            {error.message}
          </Alert>
        )}

        {!error && properties && properties.length === 0 && (
          <Alert variant="warn" title="No clubs available">
            The gateway needs at least one property in{" "}
            <code>public.properties</code>.
          </Alert>
        )}

        {properties && properties.length > 0 && (
          <div className={s.grid}>
            {properties.map((property) => {
              const copy =
                PROPERTY_COPY[property.slug] ?? PROPERTY_COPY_FALLBACK;
              return (
                <PropertyCard
                  key={property.id}
                  name={property.name}
                  href={`/${property.slug}`}
                  locale={copy.locale}
                  tagline={copy.tagline}
                  ctaLabel="Enter →"
                />
              );
            })}
          </div>
        )}
      </PageShell>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <div className={s.footerMark}>Rhythm Outdoors</div>
          <div className={s.footerCopy}>
            &copy; {new Date().getFullYear()} &middot; All rights reserved
          </div>
        </div>
      </footer>
    </div>
  );
}
