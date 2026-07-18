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
  heading: "A New Standard in Shooting Sports",
  body: "Horseshoe Bay Sporting Club is a premier private shooting destination designed exclusively for the Club at Horseshoe Bay members and their families. We offer curated shooting experiences and personalized instruction in a safe, welcoming environment that honors shooting tradition while delivering elevated hospitality.\n\nMore than a range, we are where members hone their craft, celebrate the outdoors, and create meaningful connections across generations: the new third place for the Horseshoe Bay community.",
};

const DEFAULT_WAY_IN_TILES = [
  { title: "Club Life", linkHref: "/horseshoe-bay/club-life", imageUrl: "/properties/horseshoe-bay/wayin-club-life.jpg" },
  { title: "Adventure", linkHref: "/horseshoe-bay/adventures", imageUrl: "/properties/horseshoe-bay/wayin-adventure.jpg" },
  { title: "Education", linkHref: "/horseshoe-bay/education", imageUrl: "/properties/horseshoe-bay/wayin-education.jpg" },
  { title: "Calendar", linkHref: "/horseshoe-bay/events", imageUrl: "/properties/horseshoe-bay/wayin-events-calendar.jpg" },
];

const DEFAULT_AMENITIES = [
  {
    title: "Shotgun Range",
    body: "Sporting clays course with Hill Country views, plus three shooting decks.",
    bullets: ["12-station sporting clays course", "5-Stand and Flurry decks", "Helice ring"],
    imageUrl: "/properties/horseshoe-bay/facility-1.jpg",
  },
  {
    title: "Pistol Range",
    body: "Safe, supervised sessions for shooters of all experience levels.",
    bullets: ["One 50-yard pistol bay", "Three 25-yard pistol bays", "Covered pavilion with group seating"],
    imageUrl: "/properties/horseshoe-bay/facility-2.jpg",
  },
  {
    title: "Members' Lounge",
    body: "Unwind in the clubhouse or Trophy Room after your time on the range.",
    bullets: [
      "Clubhouse with retail and food & beverage",
      "Trophy Room with game tables and lounge area",
      "The Last Shot bar: craft cocktails, six days a week",
    ],
    imageUrl: "/properties/horseshoe-bay/facility-3.jpg",
  },
];

const DEFAULT_CAMPAIGN_QUOTE = {
  heading: "Where skill and community meet tradition",
  body: "Excellence on, and off, the range.",
};

const DEFAULT_JOIN_CTA = {
  heading: "Join the Club",
  body: "We are now welcoming members of the Club at Horseshoe Bay to join us on the range. Membership secures your place at the heart of the club, and invites you and your family to shape the future of our community.",
  ctaLabel: "Learn More",
  ctaHref: "/horseshoe-bay/membership",
};

export default async function HorseshoeBayHomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "horseshoe-bay");

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
      {/* Hero — real poster image exists; hero.mp4 doesn't, so the poster
          is the resting frame (matches the mockup's graceful video fallback). */}
      <section className="relative h-[560px] w-full overflow-hidden bg-property-ink md:h-[640px]">
        <PropertyImage
          src="/properties/horseshoe-bay/video/hero-poster.jpg"
          alt=""
          filename="video/hero.mp4 + video/hero-poster.jpg"
          className="!absolute !inset-0"
        />
      </section>

      {/* Intro / About */}
      <Section tone="surfaceHighest">
        <div className="grid grid-cols-1 items-center gap-property-gutter md:grid-cols-2">
          <div className="flex flex-col items-start text-left">
            <p className="mb-3 font-property-sans text-property-eyebrow uppercase tracking-[0.2em] text-property-accent-dark">
              Welcome to the Club
            </p>
            <h1 className="property-headline font-property-display text-property-headline uppercase text-property-ink">
              {intro.heading}
            </h1>
            <RuleDivider />
            <p className="whitespace-pre-wrap font-property-sans text-property-body-lg text-property-ink-variant">
              {intro.body}
            </p>
            <div className="mt-10 flex w-full justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/properties/horseshoe-bay/img/roadrunner-mono-green.svg"
                alt="Horseshoe Bay Sporting Club roadrunner"
                className="h-auto w-32"
              />
            </div>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden border border-property-ink/10">
            <PropertyImage src={null} alt="" filename="home-about.jpg" />
          </div>
        </div>
      </Section>

      {/* Find Your Way In */}
      <Section>
        <SectionHeading eyebrow="The Sporting Life" heading="Find Your Way In" align="center" className="mb-12" />
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

      {/* Campaign line */}
      <Section tone="sage" className="text-center">
        <p className="mb-6 font-property-sans text-property-eyebrow uppercase tracking-[0.2em] text-property-accent-dark">
          {campaignQuote.heading}
        </p>
        <p className="property-display mx-auto max-w-3xl font-property-display text-4xl italic leading-snug text-property-bg md:text-5xl">
          {campaignQuote.body}
        </p>
      </Section>

      {/* Premier Amenities */}
      <Section>
        <SectionHeading
          eyebrow="Beyond Golf and Tennis"
          heading="Premier Amenities"
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

      {/* Featured events — data-driven, replaces the mockup's client-side
          Supabase fetch (rhythm-events.js) with a server-rendered query
          against our own events table. */}
      <Section tone="surfaceHighest" className="border-y border-property-ink/10">
        <div className="mb-12 flex flex-col items-end justify-between gap-6 md:flex-row">
          <SectionHeading eyebrow={<>What&rsquo;s On</>} heading="Featured Events" />
          <Link
            href="/horseshoe-bay/events"
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
                href={`/horseshoe-bay/events/${event.id}`}
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
          <SectionHeading
            eyebrow="Membership is Open"
            heading={joinCta.heading}
            size="cta"
            tone="white"
            align="center"
            divider={false}
          />
          <p className="mb-10 max-w-2xl whitespace-pre-wrap font-property-sans text-property-body-lg leading-relaxed text-white">
            {joinCta.body}
          </p>
          <PropertyButton href={joinCta.ctaHref} variant="secondary">
            {joinCta.ctaLabel}
          </PropertyButton>
        </div>
      </Section>
    </>
  );
}
