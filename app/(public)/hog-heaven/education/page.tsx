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
  heading: "Learn From The Pros",
  body: "Hog Heaven offers pistol, carbine, and shotgun training led by a cadre of seasoned professionals. Our instructors range from national champions to combat veterans with decades of experience. Whoever you train with, they share the same emphasis: progress, safety, and camaraderie.\n\nFor a more personalized experience, private lessons are also available. Whether you are just getting started or refining technique you have spent years building, one on one instruction is a fast way to build confidence and sharpen your skills.",
  ctaLabel: "Meet the Instructors",
  ctaHref: "#instructors",
  imageUrl: null as string | null,
};

const DEFAULT_PROGRAMS = [
  { title: "Shotgun", body: "Sporting clays, skeet, and trap. Learn to read a target, build a mount and swing you can repeat, and get better in good company.", linkHref: "/hog-heaven/events" },
  { title: "Pistol", body: "Pistol and carbine, from your first safe reps to real working skill. Fundamentals taught patiently, then pressure added on purpose.", linkHref: "/hog-heaven/events" },
  { title: "Outdoor Skills", body: "The skills that live off the range. Hunting prep, emergency skills, and the practical know-how that makes a day outdoors go well.", linkHref: "/hog-heaven/events" },
];

const DEFAULT_CTA = {
  heading: "Come often. Not long.",
  ctaLabel: "Join the Club",
  ctaHref: "/hog-heaven/membership",
};

export default async function HogHeavenEducationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "hog-heaven");

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

      {/* Programs */}
      <Section tone="surfaceHighest" className="border-y border-property-ink/10">
        <SectionHeading
          eyebrow="Group Classes"
          heading="Programs"
          size="large"
          align="center"
          description="Three tracks, taught on a schedule, open to anyone who signs up. Pick one to see it on the calendar."
          className="mb-16"
        />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard
              key={program.title}
              title={program.title ?? ""}
              body={program.body ?? ""}
              linkHref={program.linkHref ?? "/hog-heaven/events"}
            />
          ))}
        </div>
      </Section>

      {/* Hog Heaven PT — a standing programme, not a scheduled class and not
          filterable via the events system (this project's `events` schema
          has no type/discipline field to key it off of). Static copy, not
          CMS-wired: its shape (heading + body + bulleted detail list +
          image + CTA) doesn't fit the existing "single" section fields
          (no bullets) or "items" (not a repeating list) — see the plan
          doc's Education section for the tradeoff. */}
      <Section className="bg-property-ink" id="pt">
        <div className="grid grid-cols-1 items-center gap-property-gutter md:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden">
            <PropertyImage src={null} alt="A Hog Heaven PT session on the pistol bays" filename="img/pt.jpg" />
          </div>
          <div className="flex flex-col items-start text-left">
            <SectionHeading eyebrow="Standing Program" heading="Hog Heaven PT" tone="white" />
            <p className="mb-6 font-property-sans text-property-body-lg text-white/90">
              A military-style workout paired with guided pistol drills, built to sharpen your
              shooting under physical stress. Cardio and strength first, then you shoot tired. You
              leave wrung out and better at both.
            </p>
            <ul className="mb-8 w-full space-y-3">
              <li className="font-property-sans text-white/85">
                Programmed by <strong className="text-white">Atomic Athlete</strong>, delivered
                through the <strong className="text-white">TrainHeroic</strong> app so you can
                preview and track every session.
              </li>
              <li className="font-property-sans text-white/85">
                <strong className="text-white">Tuesday and Thursday</strong>, 7:30 to 8:15 PT, then
                8:30 to 9:00 on the pistol bays. <strong className="text-white">Saturday</strong>,
                8:00 to 8:55 and 9:00 to 9:30.
              </li>
              <li className="font-property-sans text-white/85">
                <strong className="text-white">No registration.</strong> Drop in. It is included
                with Premier membership, for members and their families.
              </li>
              <li className="font-property-sans text-white/85">
                It scales to your fitness level, but it is not the place to start if you are new to
                heavy cardio.
              </li>
            </ul>
            <PropertyButton href="/hog-heaven/membership#inquiry" variant="primary">
              Gear, Schedule &amp; Setup
            </PropertyButton>
          </div>
        </div>
      </Section>

      {/* Instructors — real /admin/instructors roster, scoped to this
          property, filterable by discipline. Hog Heaven's roster is
          expected to be near-empty until real instructors are added with
          hog-heaven in their instructor_properties. */}
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
            bookHref="/hog-heaven/membership#inquiry"
          />
        )}
      </Section>

      {/* CTA — mockup's bg-moss (#4A5439) is this theme's "sage" token;
          this theme's "moss" token maps to the mockup's hunter-mid
          (#2D3A2F) instead. See property-themes.css / the homepage's
          campaign-quote comment for the same naming mismatch. */}
      <Section tone="sage" className="text-center text-white">
        <SectionHeading heading={cta.heading} size="cta" tone="white" divider={false} />
        <PropertyButton href={cta.ctaHref} variant="primary">
          {cta.ctaLabel}
        </PropertyButton>
      </Section>
    </>
  );
}
