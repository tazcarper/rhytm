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
  heading: "Expert Instruction",
  body: "Private training and group classes for shooters at every level. Whether you are new to the sport or have years behind you, our instructors meet you where you are. One-on-one lessons in shotgun and pistol are tailored to your skill level and interests, led by professionals with decades of experience in a safe, welcoming environment.",
  ctaLabel: "Meet the Instructors",
  ctaHref: "#instructors",
  imageUrl: "/properties/horseshoe-bay/intro-education.jpg",
};

const DEFAULT_PROGRAMS = [
  {
    title: "Shotgun Classes",
    body: "Sporting clays, 5-stand, and more. From intro clinics to advanced sessions, you'll learn to read targets and build a mount & swing that will have you breaking clays.",
    linkHref: "/horseshoe-bay/events",
  },
  {
    title: "Pistol Classes",
    body: "Safe and fun training on the pistol bays, for shooters at every experience level. Fundamentals taught patiently, then built on.",
    linkHref: "/horseshoe-bay/events",
  },
  {
    title: "Private Lessons",
    body: "One-on-one instruction in shotgun and pistol, tailored to your level and your interests, led by professionals with decades of experience.",
    linkHref: "#instructors",
  },
];

const DEFAULT_CTA = {
  heading: "Book your session.",
  ctaLabel: "Join the Club",
  ctaHref: "/horseshoe-bay/membership",
};

export default async function EducationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "horseshoe-bay");

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
            <SectionHeading eyebrow="Shooting Education" heading={intro.heading} />
            <p className="mb-8 whitespace-pre-wrap font-property-sans text-property-body-lg text-property-ink-variant">
              {intro.body}
            </p>
            <PropertyButton href={intro.ctaHref} variant="ink">
              {intro.ctaLabel}
            </PropertyButton>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden border border-property-ink/10">
            <PropertyImage src={intro.imageUrl} alt="" filename="intro-education.jpg" />
          </div>
        </div>
      </Section>

      {/* Programs */}
      <Section tone="surfaceHighest" className="border-y border-property-ink/10">
        <SectionHeading
          eyebrow="Classes & Lessons"
          heading="Programs"
          size="large"
          align="center"
          description="Instruction runs on two tracks: group classes that build skills alongside other members, and private lessons one-on-one with an instructor. Pick the one that fits how you like to learn."
          className="mb-16"
        />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard
              key={program.title}
              title={program.title ?? ""}
              body={program.body ?? ""}
              linkHref={program.linkHref}
              variant="ink"
              ctaLabel={<>{program.title === "Private Lessons" ? "Book a Lesson" : "See Classes"} →</>}
            />
          ))}
        </div>
      </Section>

      {/* Instructors — real /admin/instructors roster, scoped to this
          property, filterable by discipline. */}
      <Section id="instructors" className="scroll-mt-32">
        <SectionHeading
          eyebrow="Private Training"
          heading="Meet The Instructors"
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
            bookHref="/horseshoe-bay/membership#inquiry"
          />
        )}
      </Section>

      {/* CTA */}
      <Section tone="sage" className="text-center text-white">
        <SectionHeading eyebrow="Get Started" heading={cta.heading} size="cta" tone="white" divider={false} />
        <PropertyButton href={cta.ctaHref} variant="secondary">
          {cta.ctaLabel}
        </PropertyButton>
      </Section>
    </>
  );
}
