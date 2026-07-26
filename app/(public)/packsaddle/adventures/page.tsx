import { Section } from "@/src/components/public/property-template/section";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { AdventureNotifyForm } from "@/src/components/public/property-template/adventure-notify-form";

// Deliberately NOT the cross-property getPublicAdventures() catalog that
// Horseshoe Bay's /horseshoe-bay/adventures shows. Packsaddle's own mockup
// designed a "Coming Soon" holding state instead of the real catalog —
// same decision Hog Heaven's mockup made, and its copy is word-for-word
// identical, see plan/frontend/packsaddle-remaining-pages.md.
export const dynamic = "force-dynamic";

export default function PacksaddleAdventuresPage() {
  return (
    <>
      <PageHero title="Adventure" imageSrc={null} imageFilename="hero-adventure.jpg" />

      <Section>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="mb-8 border border-property-ink/25 px-4 py-1.5 font-property-label text-[11px] uppercase tracking-[0.2em] text-property-accent-dark">
            Coming Soon
          </span>
          <SectionHeading
            heading="Guided Adventures Are on the Way"
            align="center"
            description={
              <>
                We are building out our adventure program: guided field experiences that go beyond
                the range. Sign up below and we&rsquo;ll let you know the moment it launches.
              </>
            }
            className="mb-10"
          />
          {/* Not wired to a provider yet, same as the footer and Club Life
              signups — matches the mockup's own unwired form. */}
          <AdventureNotifyForm />
        </div>
      </Section>
    </>
  );
}
