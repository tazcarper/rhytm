import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPropertyPageSection } from "@/src/services/public/property-page-content";
import { getPublicInstructorsForProperty } from "@/src/services/public/instructors";
import { Section } from "@/src/components/public/property-template/section";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PropertyImage } from "@/src/components/public/property-template/property-image";
import { PropertyButton } from "@/src/components/public/property-template/property-button";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { InstructorGrid } from "@/src/components/public/property-template/instructor-grid";
import { ProgramCard } from "@/src/components/public/property-template/program-card";

export const dynamic = "force-dynamic";

const DEFAULT_INTRO = {
  heading: "Real Skills, Taught Well",
  body: "Precision rifle, carbine, pistol, and fieldcraft, taught by people who do it. Come as you are; we'll hold you to a real standard once you're here.",
  ctaLabel: "Meet the Instructors",
  ctaHref: "#instructors",
  imageUrl: null as string | null,
};

// Each program deep-links into events.html filtered by ?program=... in the
// mockup. events.type/discipline columns exist now, but getPublicEvents()
// has no filter parameter yet (same inherited gap Horseshoe Bay and Hog
// Heaven both shipped around) — linking to the plain unfiltered calendar
// until that service-layer work happens, not fabricating a filtered view.
const DEFAULT_PROGRAMS = [
  {
    title: "Precision Rifle",
    body: "Long range, on real terrain. Precision and accuracy, and the discipline of getting one thing exactly right.",
    linkHref: "/packsaddle/events",
  },
  {
    title: "Pistol & Carbine",
    body: "The tricky blend of close-and-fast and far-and-accurate. Footwork, when to move, and how to lead with your eyes.",
    linkHref: "/packsaddle/events",
  },
  {
    title: "Uncommon Skills",
    body: "Fieldcraft, adventure races, and fitness. Resourcefulness, grit, and the quiet confidence of always being useful.",
    linkHref: "/packsaddle/events",
  },
];

const DEFAULT_CTA = {
  heading: "Come train on the mountain.",
  ctaLabel: "Join the Club",
  ctaHref: "/packsaddle/membership",
};

export default async function PacksaddleEducationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "packsaddle");

  const [introOverride, programsOverride, ctaOverride, instructors] = property
    ? await Promise.all([
        getPropertyPageSection(supabase, property.id, "education", "intro"),
        getPropertyPageSection(supabase, property.id, "education", "programs"),
        getPropertyPageSection(supabase, property.id, "education", "cta"),
        getPublicInstructorsForProperty(supabase, property.id),
      ])
    : [null, null, null, []];

  const intro = {
    heading: introOverride?.heading || DEFAULT_INTRO.heading,
    body: introOverride?.body || DEFAULT_INTRO.body,
    ctaLabel: introOverride?.ctaLabel || DEFAULT_INTRO.ctaLabel,
    ctaHref: introOverride?.ctaHref || DEFAULT_INTRO.ctaHref,
    imageUrl: introOverride?.imageUrl || DEFAULT_INTRO.imageUrl,
  };
  const programs = programsOverride?.items?.length ? programsOverride.items : DEFAULT_PROGRAMS;
  const cta = {
    heading: ctaOverride?.heading || DEFAULT_CTA.heading,
    ctaLabel: ctaOverride?.ctaLabel || DEFAULT_CTA.ctaLabel,
    ctaHref: ctaOverride?.ctaHref || DEFAULT_CTA.ctaHref,
  };

  return (
    <>
      <PageHero title="Education" imageSrc={null} imageFilename="hero-education.jpg" />

      {/* Intro */}
      <Section>
        <div className="grid grid-cols-1 items-center gap-property-gutter md:grid-cols-2">
          <div className="flex flex-col items-start text-left">
            <SectionHeading heading={intro.heading} />
            <p className="mb-8 whitespace-pre-wrap font-property-sans text-property-body-lg text-property-ink-variant">
              {intro.body}
            </p>
            <PropertyButton href={intro.ctaHref} variant="primary">
              {intro.ctaLabel}
            </PropertyButton>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden border border-property-ink/10">
            <PropertyImage src={intro.imageUrl} alt="" filename="intro-education.jpg" />
          </div>
        </div>
      </Section>

      {/* Programs — mockup uses bg-surface-container-low for the section
          and bg-surface-container for the cards (property-surface-low /
          property-surface); applied via className since Section's tone
          enum has no "surfaceLow" option. */}
      <Section className="border-y border-property-ink/10 bg-property-surface-low">
        <SectionHeading
          heading="Programs"
          size="large"
          align="center"
          description="The rifle is the front door. Pick a track to see everything on the calendar."
          className="mb-16"
        />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard key={program.title} title={program.title ?? ""} body={program.body ?? ""} linkHref={program.linkHref} />
          ))}
        </div>
      </Section>

      {/* Instructors — real /admin/instructors roster, scoped to this
          property. The mockup's own script has an interactive
          discipline/club filter that neither Horseshoe Bay's nor Hog
          Heaven's built page implements — same simplified, unfiltered
          grid both properties shipped. */}
      <Section id="instructors" className="scroll-mt-32">
        <SectionHeading
          eyebrow="Private Training"
          heading="Meet Your Instructors"
          size="large"
          align="center"
          description={
            <>
              Book one-on-one with an experienced instructor. Everything below is a{" "}
              <strong className="font-semibold text-property-ink">private lesson</strong> with a
              single instructor, not a scheduled group class.
            </>
          }
          className="mb-10"
        />
        {instructors.length === 0 ? (
          <p className="py-10 text-center font-property-sans text-property-ink/50">
            Instructors coming soon.
          </p>
        ) : (
          <InstructorGrid
            instructors={instructors.map((instructor) => ({
              name: instructor.name,
              bio: instructor.bio || "Bio coming soon.",
              disciplines: instructor.disciplines,
              photoUrl: instructor.photoUrl,
            }))}
            bookHref="/packsaddle/membership#inquiry"
          />
        )}
      </Section>

      {/* CTA */}
      <Section tone="moss" className="text-center text-white">
        <SectionHeading heading={cta.heading} size="cta" tone="white" divider={false} />
        <PropertyButton href={cta.ctaHref} variant="primary">
          {cta.ctaLabel}
        </PropertyButton>
      </Section>
    </>
  );
}
