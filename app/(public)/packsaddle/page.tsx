import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicEvents } from "@/src/services/public/events";
import { getPropertyPageSection } from "@/src/services/public/property-page-content";
import { Section } from "@/src/components/public/property-template/section";
import { RuleDivider } from "@/src/components/public/property-template/rule-divider";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PropertyImage } from "@/src/components/public/property-template/property-image";
import { PropertyButton } from "@/src/components/public/property-template/property-button";
import { FacilityCard } from "@/src/components/public/property-template/facility-card";
import { WayInGrid } from "@/src/components/public/property-template/way-in-grid";
import { UpcomingEventsStrip } from "@/src/components/public/property-template/upcoming-events-strip";

export const dynamic = "force-dynamic";

// No eyebrow above this heading — the mockup's Intro section goes
// straight from <h1> to the rule divider, unlike both other properties'
// homepages (which lead with a "Welcome to the Club" eyebrow).
const DEFAULT_INTRO = {
  heading: "Go home better than you came.",
  body: "Packsaddle is a private mountain in the Texas Hill Country, and a club built around one simple idea: people are happier and more capable when they spend real time outside, getting good at hard things.\n\nWe teach those things. Precision rifle, carbine, pistol, fieldcraft, fitness, drone work, land nav, and adventure. There is a serious rifle range here, but the gun was never the point. The point is the skill, the place, and the people you spend time with.",
};

const DEFAULT_WAY_IN_TILES = [
  { title: "Club Life", linkHref: "/packsaddle/club-life", imageUrl: null as string | null },
  { title: "Adventure", linkHref: "/packsaddle/adventures", imageUrl: null as string | null },
  { title: "Education", linkHref: "/packsaddle/education", imageUrl: null as string | null },
  { title: "Calendar", linkHref: "/packsaddle/events", imageUrl: null as string | null },
];

const DEFAULT_AMENITIES = [
  {
    title: "The Range",
    body: "A serious long-range facility built for real precision work.",
    bullets: ["≈3,750-yard range", "Elevated shooting decks", "Prep room"],
    imageUrl: null as string | null,
  },
  {
    title: "The Mountain",
    body: "Genuine elevation and terrain, rare for Central Texas.",
    bullets: ["Real elevation and terrain", "Fieldcraft and fitness", "Seclusion and privacy"],
    imageUrl: null as string | null,
  },
  {
    title: "The Lodge",
    body: "Where the fire never goes out and the day winds down.",
    bullets: ["Mountain lodge", "On-site food and water", "Post-shoot whiskey"],
    imageUrl: null as string | null,
  },
];

const DEFAULT_CAMPAIGN_QUOTE = {
  heading: "Skill is earned, not bought.",
  body: "To get people outside, doing real things, and keeping at it long enough that it becomes skill.",
};

const DEFAULT_JOIN_CTA = {
  heading: "Join the Club",
  body: "Seclusion, expert training, and real community, all on genuine elevation. Membership is limited.",
  ctaLabel: "Become a Member",
  ctaHref: "/packsaddle/membership",
};

// "Five disciplines share the mountain" — static, not
// PROPERTY_PAGE_SECTIONS-driven. Shape (title + body per row, plus four
// standalone stat callouts) doesn't fit any existing "single"/"items"
// section kind, same judgment call as Hog Heaven's non-fitting sections
// (its membership tiers, its "Hog Heaven PT" band). Flagged here for a
// future admin-config pass, not force-fit into something that doesn't
// match.
const DISCIPLINES = [
  { name: "ELR", body: "Out to ≈3,750 yards, with downrange cameras and electronic hit indicators. Rare in Texas, rare anywhere." },
  { name: "One Mile", body: "Long-range precision and friendly competition. The everyday workhorse." },
  { name: "High Angle", body: "Real elevation. Mountain and hunting simulation you cannot get on flat ground." },
  { name: "Dynamic", body: "Pistol and carbine. Movement, target transitions, and low-light work." },
  { name: "Night", body: "Suppressed, night vision, and thermal. Long range and dynamic work, after dark." },
];

const MOUNTAIN_STATS = [
  { label: "Multi-elevation lanes", body: "Shooting angles and positions simply not possible on a flat range." },
  { label: "Real-world training", body: "High-angle positions, low light, and variable terrain, year round." },
  { label: "Complete seclusion", body: "No public road access, no adjacent development, no crowds." },
  { label: "≈2,000 acres", body: "A private mountain with genuine elevation, rare for Central Texas." },
];

export default async function PacksaddleHomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "packsaddle");

  const [events, introOverride, wayInOverride, amenitiesOverride, quoteOverride, ctaOverride] = property
    ? await Promise.all([
        getPublicEvents(supabase, property.id),
        getPropertyPageSection(supabase, property.id, "home", "intro"),
        getPropertyPageSection(supabase, property.id, "home", "find-your-way"),
        getPropertyPageSection(supabase, property.id, "home", "amenities"),
        getPropertyPageSection(supabase, property.id, "home", "campaign-quote"),
        getPropertyPageSection(supabase, property.id, "home", "join-cta"),
      ])
    : [[], null, null, null, null, null];

  const featuredEvents = events.filter((event) => !event.isSoldOut || event.status === "published").slice(0, 3);

  const intro = {
    heading: introOverride?.heading || DEFAULT_INTRO.heading,
    body: introOverride?.body || DEFAULT_INTRO.body,
  };
  const wayInTiles = wayInOverride?.items?.length ? wayInOverride.items : DEFAULT_WAY_IN_TILES;
  const amenities = amenitiesOverride?.items?.length ? amenitiesOverride.items : DEFAULT_AMENITIES;
  const campaignQuote = {
    heading: quoteOverride?.heading || DEFAULT_CAMPAIGN_QUOTE.heading,
    body: quoteOverride?.body || DEFAULT_CAMPAIGN_QUOTE.body,
  };
  const joinCta = {
    heading: ctaOverride?.heading || DEFAULT_JOIN_CTA.heading,
    body: ctaOverride?.body || DEFAULT_JOIN_CTA.body,
    ctaLabel: ctaOverride?.ctaLabel || DEFAULT_JOIN_CTA.ctaLabel,
    ctaHref: ctaOverride?.ctaHref || DEFAULT_JOIN_CTA.ctaHref,
  };

  return (
    <>
      {/* Hero — looping video in the mockup (hero.mp4 + hero-poster.jpg),
          neither ever handed off, so this renders the placeholder — same
          graceful-fallback precedent as Horseshoe Bay's homepage hero. No
          headline/scrim here on purpose: the mockup's own comment notes
          the campaign line leads the section below instead. */}
      <section className="relative h-[560px] w-full overflow-hidden bg-property-ink md:h-[640px]">
        <PropertyImage src={null} alt="" filename="video/hero.mp4 + video/hero-poster.jpg" className="!absolute !inset-0" />
      </section>

      {/* Intro / About */}
      <Section tone="surfaceHighest">
        <div className="grid grid-cols-1 items-center gap-property-gutter md:grid-cols-2">
          <div className="flex flex-col items-start text-left">
            <h1 className="property-headline font-property-display text-property-headline uppercase text-property-ink">
              {intro.heading}
            </h1>
            <RuleDivider />
            <p className="whitespace-pre-wrap font-property-sans text-property-body-lg text-property-ink-variant">
              {intro.body}
            </p>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden border border-property-ink/10">
            <PropertyImage src={null} alt="" filename="intro-index.jpg" />
          </div>
        </div>
      </Section>

      {/* Find Your Way In */}
      <Section>
        <WayInGrid eyebrow="Explore" tiles={wayInTiles} />
      </Section>

      {/* Campaign line + mission — bg-teal-mid is a Packsaddle-only tone,
          applied directly via className rather than adding a new Section
          `tone` enum value (the token already exists on the theme;
          Section's tone map doesn't need to know every property-specific
          background). */}
      <Section className="bg-property-teal-mid text-center">
        <p className="mb-6 font-property-label text-property-eyebrow uppercase tracking-[0.2em] text-property-camel">
          {campaignQuote.heading}
        </p>
        <p className="property-display mx-auto max-w-3xl font-property-display text-4xl leading-snug text-property-bg md:text-5xl">
          {campaignQuote.body}
        </p>
      </Section>

      {/* What We Offer — mirrors the membership page's facilities section */}
      <Section>
        <SectionHeading heading="What We Offer" align="center" className="mb-12 mx-auto max-w-3xl" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {amenities.map((amenity) => (
            <FacilityCard
              key={amenity.title}
              title={amenity.title ?? ""}
              blurb={amenity.body ?? ""}
              items={amenity.bullets ?? []}
              imageSrc={amenity.imageUrl ?? null}
              imageFilename="facility.jpg"
            />
          ))}
        </div>
      </Section>

      {/* Five disciplines that share the mountain */}
      <Section className="bg-property-deep-olive">
        <div className="mb-14">
          <p className="mb-3 font-property-label text-[13px] uppercase tracking-[0.2em] text-property-camel">
            The Mountain
          </p>
          <h2 className="property-headline max-w-3xl font-property-display text-property-headline uppercase text-white">
            Five disciplines share the mountain.
          </h2>
          <RuleDivider />
        </div>
        <div className="border-t border-white/15">
          {DISCIPLINES.map((discipline) => (
            <div
              key={discipline.name}
              className="grid grid-cols-1 items-baseline gap-4 border-b border-white/15 py-6 md:grid-cols-12 md:gap-8"
            >
              <h3 className="property-headline font-property-display text-2xl uppercase text-white md:col-span-3">
                {discipline.name}
              </h3>
              <p className="font-property-sans text-white/80 md:col-span-9">{discipline.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-4">
          {MOUNTAIN_STATS.map((stat) => (
            <div key={stat.label}>
              <p className="mb-2 font-property-label text-[11px] uppercase tracking-widest text-property-camel">
                {stat.label}
              </p>
              <p className="font-property-sans text-sm text-white/70">{stat.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Featured events */}
      <Section tone="surfaceHighest" className="border-y border-property-ink/10">
        <UpcomingEventsStrip events={featuredEvents} basePath="/packsaddle" heading="Featured Events" />
      </Section>

      {/* Join CTA */}
      <Section tone="moss" className="text-center text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <SectionHeading heading={joinCta.heading} size="cta" tone="white" align="center" divider={false} />
          <p className="mb-10 max-w-2xl whitespace-pre-wrap font-property-sans text-property-body-lg leading-relaxed text-white/80">
            {joinCta.body}
          </p>
          <PropertyButton href={joinCta.ctaHref} variant="primary">
            {joinCta.ctaLabel}
          </PropertyButton>
        </div>
      </Section>
    </>
  );
}
