import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicEvents } from "@/src/services/public/events";
import { getPropertyPageSection } from "@/src/services/public/property-page-content";
import { Section } from "@/src/components/public/property-template/section";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PropertyButton } from "@/src/components/public/property-template/property-button";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { UpcomingEventsStrip } from "@/src/components/public/property-template/upcoming-events-strip";
import { InstagramGrid } from "@/src/components/public/property-template/instagram-grid";

// "The Latest" (a posts/blog feed) and "Standing Programs" (pulled from a
// `type` field the real events table deliberately doesn't have) are in the
// original mockup but out of scope here — both need real backend work
// (a new posts table; an events schema change) that wasn't part of this
// pilot pass. See plan/frontend/horseshoe-bay-remaining-pages.md. This page
// covers everything else: hero, real upcoming events, the Facebook CTA,
// and the Instagram section.

const DEFAULT_COMMUNITY = {
  heading: "Join the Members' Group",
  body: "Stay up to date on events, announcements, and more in our private Facebook group for members.",
  ctaLabel: "Join the Facebook Group",
  ctaHref: "#",
};

const DEFAULT_INSTAGRAM = {
  heading: "@hsbsportingclub",
  ctaLabel: "Follow Us",
  ctaHref: "https://instagram.com/hsbsportingclub",
};

const DEFAULT_INSTAGRAM_PHOTOS = [
  { imageUrl: undefined, linkHref: "https://instagram.com/hsbsportingclub" },
  { imageUrl: undefined, linkHref: "https://instagram.com/hsbsportingclub" },
  { imageUrl: undefined, linkHref: "https://instagram.com/hsbsportingclub" },
  { imageUrl: undefined, linkHref: "https://instagram.com/hsbsportingclub" },
  { imageUrl: undefined, linkHref: "https://instagram.com/hsbsportingclub" },
];

export const dynamic = "force-dynamic";

export default async function ClubLifePage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "horseshoe-bay");

  const [events, communityOverride, instagramOverride, instagramPhotosOverride] = property
    ? await Promise.all([
        getPublicEvents(supabase, property.id),
        getPropertyPageSection(supabase, property.id, "club_life", "community"),
        getPropertyPageSection(supabase, property.id, "club_life", "instagram"),
        getPropertyPageSection(supabase, property.id, "club_life", "instagram-photos"),
      ])
    : [[], null, null, null];

  const upcomingEvents = events.filter((event) => !event.isSoldOut || event.status === "published").slice(0, 3);

  const community = {
    heading: communityOverride?.heading || DEFAULT_COMMUNITY.heading,
    body: communityOverride?.body || DEFAULT_COMMUNITY.body,
    ctaLabel: communityOverride?.ctaLabel || DEFAULT_COMMUNITY.ctaLabel,
    ctaHref: communityOverride?.ctaHref || DEFAULT_COMMUNITY.ctaHref,
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
        <UpcomingEventsStrip
          events={upcomingEvents}
          basePath="/horseshoe-bay"
          heading="On the Calendar"
          eyebrow={<>What&rsquo;s Next</>}
        />
      </Section>

      {/* Join the Members' Group */}
      <Section tone="sage" className="text-white">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow="Community" heading={community.heading} size="cta" tone="white" divider={false} />
            <p className="max-w-md font-property-sans text-property-body-lg leading-relaxed text-white/85">
              {community.body}
            </p>
          </div>
          <div className="w-full lg:max-w-md lg:justify-self-end">
            <PropertyButton
              href={community.ctaHref}
              variant="secondary"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
            >
              {community.ctaLabel}
            </PropertyButton>
          </div>
        </div>
      </Section>

      {/* Instagram */}
      <Section>
        <InstagramGrid
          eyebrow="Follow Us on Instagram"
          heading={instagram.heading}
          ctaLabel={instagram.ctaLabel}
          ctaHref={instagram.ctaHref}
          photos={instagramPhotos}
          aspect="portrait"
        />
      </Section>
    </>
  );
}
