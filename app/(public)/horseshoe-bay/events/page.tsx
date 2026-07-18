import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPublicEvents } from "@/src/services/public/events";
import { getPropertyPageSection } from "@/src/services/public/property-page-content";
import { Section } from "@/src/components/public/property-template/section";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PropertyButton } from "@/src/components/public/property-template/property-button";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { EventsListing } from "@/src/components/public/property-template/events-listing";

const DEFAULT_INCLUDED_BAND = {
  body: "Most of what fills this calendar: leagues, classes, and social events, comes free with your membership.",
};

const DEFAULT_MEMBERS_CTA = {
  heading: "Members Get First Access",
  body: "Members receive early access to registrations and member-only invitations to everything on the calendar.",
  ctaLabel: "Become a Member",
  ctaHref: "/horseshoe-bay/membership",
};

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "horseshoe-bay");

  const [events, includedOverride, ctaOverride] = property
    ? await Promise.all([
        getPublicEvents(supabase, property.id),
        getPropertyPageSection(supabase, property.id, "events", "included-band"),
        getPropertyPageSection(supabase, property.id, "events", "members-cta"),
      ])
    : [[], null, null];

  const includedBand = { body: includedOverride?.body || DEFAULT_INCLUDED_BAND.body };
  const membersCta = {
    heading: ctaOverride?.heading || DEFAULT_MEMBERS_CTA.heading,
    body: ctaOverride?.body || DEFAULT_MEMBERS_CTA.body,
    ctaLabel: ctaOverride?.ctaLabel || DEFAULT_MEMBERS_CTA.ctaLabel,
    ctaHref: ctaOverride?.ctaHref || DEFAULT_MEMBERS_CTA.ctaHref,
  };

  return (
    <>
      <PageHero title="Event Calendar" imageSrc={null} imageFilename="hero-events.jpg" />

      {/* Included with Membership */}
      <Section tone="sage" className="text-center text-white">
        <p className="mb-3 font-property-sans text-property-eyebrow uppercase tracking-[0.2em] text-property-accent-dark">
          Included with Membership
        </p>
        <p className="mx-auto max-w-3xl font-property-display text-2xl leading-snug text-white md:text-3xl">
          {includedBand.body}
        </p>
      </Section>

      <EventsListing events={events} basePath="/horseshoe-bay" />

      {/* Membership CTA */}
      <Section tone="sage" className="text-center text-white">
        <SectionHeading
          eyebrow="Membership"
          heading={membersCta.heading}
          tone="white"
          divider={false}
          description={membersCta.body}
        />
        <PropertyButton href={membersCta.ctaHref} variant="secondary" className="mt-8">
          {membersCta.ctaLabel}
        </PropertyButton>
      </Section>
    </>
  );
}
