import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicFaqCategories } from "@/src/services/public/faq";
import { Section } from "@/src/components/public/property-template/section";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { PropertyButton } from "@/src/components/public/property-template/property-button";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { FaqCategorySection } from "@/src/components/public/property-template/faq-accordion";

// No Packsaddle mockup exists for this page (same 8-file mockup set gap Hog
// Heaven had) — reuses Horseshoe Bay's FAQ chrome/layout verbatim
// (FaqAccordion reads property_faq_entries scoped by property_id, already
// property-agnostic). No rows seeded yet — the existing empty state ("FAQ
// content coming soon") covers that honestly. Real phone/email are still
// literal bracket placeholders everywhere else on this property (see
// PROPERTY_PROFILES["packsaddle"]) — carried through here too rather than
// inventing contact info that would look real.
export const dynamic = "force-dynamic";

export default async function PacksaddleFaqPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "packsaddle");
  const categories = property ? await getPublicFaqCategories(supabase, property.id) : [];

  return (
    <>
      <PageHero title="FAQs" imageSrc={null} imageFilename="hero-faq.jpg" />

      {/* Intro + jump links */}
      <Section bleed>
        <div className="mx-auto max-w-property-max px-property-gutter pt-property-section-desktop">
          <div className="max-w-2xl">
            <p className="mb-3 font-property-label text-property-eyebrow uppercase tracking-[0.2em] text-property-accent-dark">
              Good to Know
            </p>
            <p className="font-property-sans text-property-body-lg text-property-ink-variant">
              The questions we get asked most, answered. If yours is not here, call the club or send
              us a note.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-2">
            {categories.map((category) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="border border-property-ink/15 px-4 py-2 font-property-label text-[11px] uppercase tracking-[0.18em] text-property-ink-variant transition-colors hover:text-property-accent-dark"
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
              Call or email the club. Someone is always around.
            </p>
            <div className="flex flex-wrap gap-4">
              <PropertyButton href="tel:" variant="primary">
                [phone number]
              </PropertyButton>
              <PropertyButton href="mailto:" variant="outline">
                Email the Club
              </PropertyButton>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
