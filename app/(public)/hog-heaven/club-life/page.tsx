import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicEvents } from "@/src/services/public/events";
import { getPropertyPageSection } from "@/src/services/public/property-page-content";
import { Section } from "@/src/components/public/property-template/section";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PropertyImage } from "@/src/components/public/property-template/property-image";
import { PropertyButton } from "@/src/components/public/property-template/property-button";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { NewsletterForm } from "@/src/components/public/property-template/newsletter-form";
import Link from "next/link";

// "The Latest" (a posts/blog feed) and "Always Running" (standing programs,
// pulled from a `type` field the real events table deliberately doesn't
// have) are in the original mockup but out of scope here, same call already
// made for Horseshoe Bay's club-life page — see plan/frontend/
// hog-heaven-remaining-pages.md. This page covers everything else: hero,
// real upcoming events, The Dispatch email band, and Instagram.

export const dynamic = "force-dynamic";

const DEFAULT_DISPATCH = {
  heading: "The Club, In Your Inbox",
  body: "What is on the calendar, what happened last weekend, and the occasional story worth telling.",
};

const DEFAULT_INSTAGRAM = {
  heading: "@hogheavensporting",
  ctaLabel: "Follow Us",
  ctaHref: "https://instagram.com/hogheavensporting",
};

const DEFAULT_INSTAGRAM_PHOTOS = [
  { imageUrl: undefined, linkHref: "https://instagram.com/hogheavensporting" },
  { imageUrl: undefined, linkHref: "https://instagram.com/hogheavensporting" },
  { imageUrl: undefined, linkHref: "https://instagram.com/hogheavensporting" },
  { imageUrl: undefined, linkHref: "https://instagram.com/hogheavensporting" },
  { imageUrl: undefined, linkHref: "https://instagram.com/hogheavensporting" },
];

export default async function HogHeavenClubLifePage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "hog-heaven");

  const [events, dispatchOverride, instagramOverride, instagramPhotosOverride] = property
    ? await Promise.all([
        getPublicEvents(supabase, property.id),
        getPropertyPageSection(supabase, property.id, "club_life", "community"),
        getPropertyPageSection(supabase, property.id, "club_life", "instagram"),
        getPropertyPageSection(supabase, property.id, "club_life", "instagram-photos"),
      ])
    : [[], null, null, null];

  const upcomingEvents = events.filter((event) => !event.isSoldOut || event.status === "published").slice(0, 3);

  const dispatch = {
    heading: dispatchOverride?.heading || DEFAULT_DISPATCH.heading,
    body: dispatchOverride?.body || DEFAULT_DISPATCH.body,
  };
  const instagram = {
    heading: instagramOverride?.heading || DEFAULT_INSTAGRAM.heading,
    ctaLabel: instagramOverride?.ctaLabel || DEFAULT_INSTAGRAM.ctaLabel,
    ctaHref: instagramOverride?.ctaHref || DEFAULT_INSTAGRAM.ctaHref,
  };
  const instagramPhotos = instagramPhotosOverride?.items?.length
    ? instagramPhotosOverride.items
    : DEFAULT_INSTAGRAM_PHOTOS;

  return (
    <>
      <PageHero title="Club Life" imageSrc={null} imageFilename="hero-club-life.jpg" />

      {/* What's Next — real upcoming events, same pattern as the homepage's
          featured-events strip. */}
      <Section tone="surfaceHighest" className="border-y border-property-ink/10">
        <div className="mb-12 flex flex-col items-end justify-between gap-6 md:flex-row">
          <SectionHeading eyebrow={<>What&rsquo;s Next</>} heading="On the Calendar" />
          <Link
            href="/hog-heaven/events"
            className="border-b border-property-ink pb-1 font-property-sans text-property-eyebrow uppercase tracking-widest text-property-ink transition-colors hover:border-property-camel"
          >
            View Full Calendar
          </Link>
        </div>

        {upcomingEvents.length === 0 ? (
          <p className="font-property-sans italic text-property-ink-variant">
            No events scheduled right now — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {upcomingEvents.map((event) => (
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

      {/* The Dispatch — email, not membership. Unlike Horseshoe Bay's
          Facebook-group CTA in this same section slot, Hog Heaven's mockup
          embeds a real (mockup-unwired) signup form directly in the band,
          so this renders NewsletterForm rather than a CTA link. Same
          `club_life`/`community` section key as Horseshoe Bay — see that
          config entry's helpText. */}
      <Section tone="sage" className="text-white">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading heading={dispatch.heading} size="cta" tone="white" divider={false} />
            <p className="max-w-md font-property-sans text-property-body-lg leading-relaxed text-white/85">
              {dispatch.body}
            </p>
          </div>
          <div className="w-full lg:max-w-md lg:justify-self-end">
            <NewsletterForm />
            <p className="mt-4 font-property-sans text-sm leading-snug text-white/70">
              Members and neighbors both. Every couple of weeks, and you can leave any time.
            </p>
          </div>
        </div>
      </Section>

      {/* Instagram */}
      <Section>
        <div className="mb-8 flex items-end justify-between">
          <SectionHeading eyebrow="Follow Along" heading={instagram.heading} />
          <PropertyButton href={instagram.ctaHref} variant="ghost" target="_blank" rel="noopener noreferrer">
            {instagram.ctaLabel}
          </PropertyButton>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {instagramPhotos.map((photo, index) => {
            const content = (
              <div className="relative aspect-square overflow-hidden">
                <PropertyImage src={photo.imageUrl ?? null} alt="" filename="ig-photo.jpg" />
              </div>
            );
            return photo.linkHref ? (
              <a
                key={photo.linkHref + index}
                href={photo.linkHref}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                {content}
              </a>
            ) : (
              <div key={index}>{content}</div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
