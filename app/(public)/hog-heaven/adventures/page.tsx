import { Section } from "@/src/components/public/property-template/section";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PageHero } from "@/src/components/public/property-template/page-hero";

// Deliberately NOT the cross-property getPublicAdventures() catalog that
// Horseshoe Bay's /horseshoe-bay/adventures shows. Hog Heaven's own mockup
// designed a "Coming Soon" holding state instead of the real catalog — a
// decision made explicitly for this page (not guessed), see
// plan/frontend/hog-heaven-remaining-pages.md's Adventures section.
export const dynamic = "force-dynamic";

export default function HogHeavenAdventuresPage() {
  return (
    <>
      <PageHero title="Adventure" imageSrc={null} imageFilename="hero-adventure.jpg" />

      <Section>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="mb-8 border border-property-ink/25 px-4 py-1.5 font-property-sans text-[11px] uppercase tracking-[0.2em] text-property-accent-dark">
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
          <form
            className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
            onSubmit={(event) => event.preventDefault()}
          >
            <input
              type="email"
              required
              placeholder="Email Address"
              className="flex-grow border border-property-ink/20 bg-property-surface-lowest p-4 font-property-sans text-property-ink placeholder:text-property-ink/40 focus:border-property-accent focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 bg-property-sage px-8 py-4 font-property-sans text-[13px] font-semibold uppercase tracking-[0.1em] text-white transition-opacity duration-300 hover:opacity-90"
            >
              Notify Me
            </button>
          </form>
        </div>
      </Section>
    </>
  );
}
