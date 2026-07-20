import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicFaqCategories } from "@/src/services/public/faq";
import { Section } from "@/src/components/public/property-template/section";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { PropertyButton } from "@/src/components/public/property-template/property-button";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { FaqCategorySection } from "@/src/components/public/property-template/faq-accordion";

// No Hog Heaven mockup exists for this page (the mockup set has 8 files,
// no faq.html) — per project decision, this reuses Horseshoe Bay's FAQ
// chrome/layout verbatim (FaqAccordion already reads property_faq_entries
// scoped by property_id, so the plumbing is property-agnostic). No
// property_faq_entries rows have been seeded for Hog Heaven yet — the
// page's existing empty state ("FAQ content coming soon") covers that
// honestly rather than fabricating answers. Real Q&A content needs to come
// from the client/developer before this ships. Also note: the FAQ admin
// tab is currently hidden for Horseshoe Bay (client request, table/editor
// code intact) — that decision needs revisiting for both properties before
// Hog Heaven's FAQ can be self-served, not silently re-enabled here.
export const dynamic = "force-dynamic";

export default async function HogHeavenFaqPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "hog-heaven");
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
              The questions we get asked most, answered. If yours is not here, call the club or send
              us a note.
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
              Call or email the club. Someone is always around.
            </p>
            <div className="flex flex-wrap gap-4">
              <PropertyButton href="tel:15129876938" variant="primary">
                (512) 987-6938
              </PropertyButton>
              <PropertyButton href="mailto:shoot@hogheavensportingclub.com" variant="outline">
                Email the Club
              </PropertyButton>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
