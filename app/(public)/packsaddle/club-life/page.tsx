import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicEvents } from "@/src/services/public/events";
import { getPropertyPageSection } from "@/src/services/public/property-page-content";
import { Section } from "@/src/components/public/property-template/section";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { NewsletterForm } from "@/src/components/public/property-template/newsletter-form";
import { UpcomingEventsStrip } from "@/src/components/public/property-template/upcoming-events-strip";
import { InstagramGrid } from "@/src/components/public/property-template/instagram-grid";

// "The Latest" (a posts/blog feed) and "Always Running" (standing programs,
// pulled from a `type` field the real events table deliberately doesn't
// have) are in the original mockup but out of scope here, same call already
// made for both Horseshoe Bay's and Hog Heaven's club-life pages. This page
// covers everything else: hero, real upcoming events, The Dispatch email
// band, and Instagram.

export const dynamic = "force-dynamic";

const DEFAULT_DISPATCH = {
  heading: "The Club, In Your Inbox",
  body: "What is on the calendar, what happened last weekend, and the occasional story worth telling.",
};

const DEFAULT_INSTAGRAM = {
  heading: "@packsaddleprecision",
  ctaLabel: "Follow Us",
  ctaHref: "https://instagram.com/packsaddleprecision",
};

const DEFAULT_INSTAGRAM_PHOTOS = [
  { imageUrl: undefined, linkHref: "https://instagram.com/packsaddleprecision" },
  { imageUrl: undefined, linkHref: "https://instagram.com/packsaddleprecision" },
  { imageUrl: undefined, linkHref: "https://instagram.com/packsaddleprecision" },
  { imageUrl: undefined, linkHref: "https://instagram.com/packsaddleprecision" },
  { imageUrl: undefined, linkHref: "https://instagram.com/packsaddleprecision" },
];

export default async function PacksaddleClubLifePage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "packsaddle");

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
        <UpcomingEventsStrip
          events={upcomingEvents}
          basePath="/packsaddle"
          heading="On the Calendar"
          eyebrow={<>What&rsquo;s Next</>}
        />
      </Section>

      {/* The Dispatch — email, not membership. Reuses the shared
          NewsletterForm client component (already "use client", already
          unwired to match the mockup) — same pattern Hog Heaven's
          club-life page uses in this slot. */}
      <Section tone="moss" className="text-white">
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
        <InstagramGrid
          eyebrow="Follow Along"
          heading={instagram.heading}
          ctaLabel={instagram.ctaLabel}
          ctaHref={instagram.ctaHref}
          photos={instagramPhotos}
        />
      </Section>
    </>
  );
}
