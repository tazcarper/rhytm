import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicAdventures } from "@/src/services/public/adventures";
import { getPropertyPageSection } from "@/src/services/public/property-page-content";
import { AdventureTile } from "@/src/components/public/adventure-tile";
import { Alert } from "@/lib/ui";
import { Section } from "@/src/components/public/property-template/section";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PageHero } from "@/src/components/public/property-template/page-hero";

export const dynamic = "force-dynamic";

const DEFAULT_INTRO = {
  heading: "Where We're Going Next",
  body: "Curated journeys and signature experiences — a members' privilege. Open to wander; reserved to book.",
};

// Re-skin of the existing cross-property adventures catalog
// (src/services/public/adventures.ts, AdventureTile) inside the new
// Horseshoe Bay chrome — data-fetching and the reserve flow are
// untouched. Adventures are deliberately cross-property (curated 3rd-
// party trips, not tied to one club — see the service's own header
// comment), so this page shows the same full catalog every property
// would; only the surrounding chrome is Horseshoe Bay's. Each tile links
// to the existing /adventures/[id] detail + reserve page (unchanged —
// its own Stripe/waitlist/guest-manifest logic is out of scope for a
// re-skin).
export default async function HorseshoeBayAdventuresPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "horseshoe-bay");
  const { data, error } = await getPublicAdventures(supabase);
  const adventures = data ?? [];
  const [feature, ...rest] = adventures;

  const introOverride = property ? await getPropertyPageSection(supabase, property.id, "adventures", "intro") : null;
  const intro = {
    heading: introOverride?.heading || DEFAULT_INTRO.heading,
    body: introOverride?.body || DEFAULT_INTRO.body,
  };

  return (
    <>
      <PageHero title="Adventure" imageSrc={null} imageFilename="hero-adventure.jpg" />

      <Section>
        <SectionHeading
          eyebrow="Member Adventures"
          heading={intro.heading}
          align="center"
          description={<span className="whitespace-pre-wrap">{intro.body}</span>}
          className="mb-12"
        />

        {error && (
          <Alert variant="error" title="Could not load adventures">
            {error.message}
          </Alert>
        )}

        {adventures.length > 0 && (
          <div className="flex flex-col gap-8">
            {feature && <AdventureTile adventure={feature} feature index={0} />}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((adventure, i) => (
                  <AdventureTile key={adventure.id} adventure={adventure} index={i + 1} />
                ))}
              </div>
            )}
          </div>
        )}

        {!error && adventures.length === 0 && (
          <Alert variant="info" title="No adventures open right now">
            Curated trips for the membership are listed here as they&rsquo;re scheduled. Check back
            soon.
          </Alert>
        )}
      </Section>
    </>
  );
}
