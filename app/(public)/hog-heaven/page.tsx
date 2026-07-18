import Link from "next/link";
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

export const dynamic = "force-dynamic";

const DEFAULT_INTRO = {
  heading: "The Country Club Dripping Springs Deserves",
  body: "Set against the Texas Hill Country, Hog Heaven is a sporting club, outdoor education facility, event venue, and nature preserve. Over 120 acres of pristine Hill Country, anchored by a 15-acre stocked lake, thirty minutes from Austin. Fishing, archery, sporting clays, and pistol, taught by best-in-class instructors, plus a full calendar of social events. We connect accessible outdoor activities with great community.\n\nHog Heaven Sporting Club is a place to learn new skills, master your craft, and gather in community. But most of all, for those of us who feel the outdoors as part of our soul and our identity, this is a little slice of heaven, right in your own backyard.",
};

const DEFAULT_WAY_IN_TILES = [
  { title: "Club Life", linkHref: "/hog-heaven/club-life", imageUrl: "/properties/hog-heaven/wayin-club-life.jpg" },
  { title: "Adventure", linkHref: "/hog-heaven/adventures", imageUrl: "/properties/hog-heaven/wayin-adventure.jpg" },
  { title: "Education", linkHref: "/hog-heaven/education", imageUrl: "/properties/hog-heaven/wayin-education.jpg" },
  { title: "Calendar", linkHref: "/hog-heaven/events", imageUrl: "/properties/hog-heaven/wayin-events-calendar.jpg" },
];

const DEFAULT_AMENITIES = [
  {
    title: "Shotgun",
    body: "Sporting clays course wrapping around the lake, plus skeet, trap, and 5-stand.",
    bullets: ["12 sporting clays stations", "4 trap and skeet fields", "5 station super sporting course", "Two 5-stands"],
    imageUrl: "/properties/hog-heaven/facility-shotgun.jpg",
  },
  {
    title: "Pistol & Carbine",
    body: "Nine outdoor bays with interactive steel and paper targets, and instruction at every level.",
    bullets: ["9 pistol and carbine bays", "Interactive steel and paper targets", "Lessons from working pros"],
    imageUrl: "/properties/hog-heaven/facility-pistol.jpg",
  },
  {
    title: "Archery & The Lake",
    body: "A 3D archery gallery and a spring-fed lake stocked and structured for real fishing.",
    bullets: [
      "3D gallery with Texas native and big game targets",
      "15-acre stocked lake, 200+ underwater habitat structures",
      "Bass, bluegill, and catfish",
    ],
    imageUrl: "/properties/hog-heaven/facility-archery.jpg",
  },
];

const DEFAULT_CAMPAIGN_QUOTE = {
  heading: "A little slice of heaven. Just minutes away.",
  body: "Healthy people and strong community, built around the outdoors.",
};

const DEFAULT_JOIN_CTA = {
  heading: "Join the Club",
  body: "An immersive sporting and lifestyle experience less than 30 minutes from Austin, for people passionate about their craft, their community, and the outdoors.",
  ctaLabel: "Explore Membership",
  ctaHref: "/hog-heaven/membership",
};

export default async function HogHeavenHomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "hog-heaven");

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
      {/* Hero — no real photography/video handed off yet, so the poster
          slot renders PropertyImage's graceful placeholder (matches the
          mockup's own "swap this file" convention). */}
      <section className="relative h-[560px] w-full overflow-hidden bg-property-ink md:h-[640px]">
        <PropertyImage
          src={null}
          alt=""
          filename="video/hero.mp4 + video/hero-poster.jpg"
          className="!absolute !inset-0"
        />
      </section>

      {/* Intro / About — no eyebrow line in this mockup, unlike Horseshoe
          Bay's; straight to headline. */}
      <Section tone="paper">
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
        <SectionHeading eyebrow="Club Life" heading="Find Your Way In" align="center" className="mb-12" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
          {wayInTiles.map((tile) => (
            <Link
              key={tile.linkHref ?? tile.title}
              href={tile.linkHref ?? "#"}
              className="group relative flex aspect-[4/5] items-end overflow-hidden border border-property-ink/10"
            >
              <PropertyImage
                src={tile.imageUrl ?? null}
                alt=""
                filename="wayin-tile.jpg"
                className="!absolute !inset-0 transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-property-scrim/90 via-property-scrim/45 to-transparent" />
              <div className="relative z-10 flex w-full flex-col items-center p-6 text-center">
                <h3 className="property-headline mb-2 font-property-display text-2xl uppercase text-white">
                  {tile.title}
                </h3>
                <span className="flex items-center font-property-sans text-property-label uppercase text-property-accent-dark transition-colors group-hover:text-property-surface-lowest">
                  Explore
                  <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
                    →
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Campaign line — mockup's hunter-mid field, distinct from the
          moss used on the Join CTA below. */}
      <Section tone="moss" className="text-center">
        <p className="mb-6 font-property-sans text-property-eyebrow uppercase tracking-[0.2em] text-property-accent-dark">
          {campaignQuote.heading}
        </p>
        <p className="property-display mx-auto max-w-3xl font-property-display text-4xl italic leading-snug text-property-bg md:text-5xl">
          {campaignQuote.body}
        </p>
      </Section>

      {/* Facilities / What We Offer */}
      <Section>
        <SectionHeading
          heading="All of your outdoor pursuits in one place"
          align="center"
          className="mb-12 mx-auto max-w-3xl"
        />
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

      {/* Featured events — data-driven, same server-rendered query as
          Horseshoe Bay's homepage. */}
      <Section tone="paper" className="border-y border-property-ink/10">
        <div className="mb-12 flex flex-col items-end justify-between gap-6 md:flex-row">
          <SectionHeading heading="Featured Events" />
          <Link
            href="/hog-heaven/events"
            className="border-b border-property-ink pb-1 font-property-sans text-property-eyebrow uppercase tracking-widest text-property-ink transition-colors hover:border-property-camel"
          >
            View Full Calendar
          </Link>
        </div>

        {featuredEvents.length === 0 ? (
          <p className="font-property-sans italic text-property-ink-variant">
            No events scheduled right now — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {featuredEvents.map((event) => (
              <Link
                key={event.id}
                href={`/hog-heaven/events/${event.id}`}
                className="group block border border-property-ink/10 bg-property-surface-lowest"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <PropertyImage src={event.imageUrl} alt="" filename="events.jpg" />
                </div>
                <div className="p-6">
                  <h3 className="property-headline mb-2 font-property-display text-xl uppercase text-property-ink">
                    {event.title}
                  </h3>
                  <p className="font-property-sans text-sm text-property-ink-variant">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "America/Chicago",
                    }).format(new Date(event.startAt))}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Join CTA */}
      <Section tone="sage" className="text-center text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <SectionHeading heading={joinCta.heading} size="cta" tone="white" align="center" divider={false} />
          <p className="mb-10 max-w-2xl whitespace-pre-wrap font-property-sans text-property-body-lg leading-relaxed text-white">
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
