import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicFaqCategories } from "@/src/services/public/faq";
import { Section } from "@/src/components/public/property-template/section";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { PropertyButton } from "@/src/components/public/property-template/property-button";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { FaqCategorySection } from "@/src/components/public/property-template/faq-accordion";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "horseshoe-bay");
  const categories = property ? await getPublicFaqCategories(supabase, property.id) : [];

  return (
    <>
      <PageHero title="FAQs" imageSrc={null} imageFilename="hero-faq.jpg" />

      {/* Intro + jump links */}
      <Section bleed>
        <div className="mx-auto max-w-property-max px-property-gutter pt-property-section-desktop">
          <div className="max-w-2xl">
            <p className="mb-3 font-property-sans text-property-eyebrow uppercase tracking-[0.2em] text-property-accent-dark">
              Good to Know
            </p>
            <p className="font-property-sans text-property-body-lg text-property-ink-variant">
              The questions we get asked most, answered. If yours is not here, call the club, send us
              a note, or stop by the concierge desk in the clubhouse.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-2">
            {categories.map((category) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="border border-property-ink/15 px-4 py-2 font-property-sans text-[11px] uppercase tracking-[0.18em] text-property-ink-variant transition-colors hover:text-property-accent-dark"
              >
                {category.title}
              </a>
            ))}
          </div>
        </div>
      </Section>

      {/* Questions */}
      <Section bleed>
        <div className="mx-auto max-w-property-max px-property-gutter pb-property-section-desktop pt-20">
          {categories.length === 0 ? (
            <p className="text-center font-property-sans italic text-property-ink-variant">
              FAQ content coming soon.
            </p>
          ) : (
            categories.map((category) => <FaqCategorySection key={category.id} category={category} />)
          )}

          <div className="mt-4 bg-property-surface-highest p-10 md:p-14">
            <SectionHeading eyebrow="Still Have a Question?" heading="Just Ask" divider={false} />
            <p className="mb-8 max-w-xl font-property-sans text-property-body-lg text-property-ink-variant">
              Call or email the club, or visit the concierge desk in the clubhouse. Someone is always
              around.
            </p>
            <div className="flex flex-wrap gap-4">
              <PropertyButton href="tel:8308251550" variant="primary">
                830.825.1550
              </PropertyButton>
              <PropertyButton href="mailto:info@hsbsportingclub.com" variant="outline">
                Email the Club
              </PropertyButton>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
