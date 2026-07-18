import { Fragment } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPropertyPageSection } from "@/src/services/public/property-page-content";
import { Section } from "@/src/components/public/property-template/section";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PropertyImage } from "@/src/components/public/property-template/property-image";
import { PropertyButton } from "@/src/components/public/property-template/property-button";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { FacilityCard } from "@/src/components/public/property-template/facility-card";
import { SplitGallery } from "@/src/components/public/property-template/split-gallery";
import { MembershipInquiryForm } from "@/src/components/public/property-template/membership-inquiry-form";
import { MembershipInquiryModal } from "@/src/components/public/property-template/membership-inquiry-modal";

export const dynamic = "force-dynamic";

const DEFAULT_INTRO = {
  heading: "Reserve Your Place",
  body: "Set within 150+ acres of Texas Hill Country, Horseshoe Bay Sporting Club gives members of The Club at Horseshoe Bay and their families exclusive access to shooting sports and outdoor recreation. Thoughtfully designed shotgun and pistol ranges, expert instruction, and a staff that knows the sport and knows its members, all in a private, resort-integrated setting built around tradition, training, and time well spent.",
  ctaLabel: "Request Membership Info",
  ctaHref: "#inquiry",
  imageUrl: "/properties/horseshoe-bay/intro-membership.jpg",
};

const DEFAULT_PRICING = [
  { title: "$2,950", body: "Initiation" },
  { title: "$295", body: "Per Month" },
];

const DEFAULT_BENEFITS = [
  { title: "Curated Shooting Experiences", body: "Sporting clays, 5-Stand, pistol, and more. All included for members and their guests." },
  { title: "Personalized Instruction", body: "Expert coaching for every discipline and every experience level." },
  { title: "The Last Shot Bar", body: "Craft cocktails and cold beer in the Trophy Room, six days a week." },
  { title: "Refined Hospitality", body: "Elevated hospitality that exceeds resort-level expectations." },
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

const DEFAULT_SPOTLIGHT = {
  heading: "The Last Shot Bar",
  body: "Nestled inside the Trophy Room, The Last Shot Bar is where members unwind with craft cocktails and cold beer after time on the range. Six days a week, this is your place to decompress, connect, and drink well.",
  images: [
    { src: "/properties/horseshoe-bay/img/clublife-1.jpg", filename: "img/clublife-1.jpg" },
    { src: "/properties/horseshoe-bay/img/clublife-2.jpg", filename: "img/clublife-2.jpg" },
    { src: "/properties/horseshoe-bay/img/clublife-3.jpg", filename: "img/clublife-3.jpg" },
  ],
};

const DEFAULT_ONBOARDING_STEPS = [
  { title: "Safety and the Rules", body: "Firearm handling standards, range etiquette, and what is and is not allowed where." },
  { title: "A Walk of the Property", body: "Where everything is, how to check in, and how the day actually works." },
  { title: "Your Access", body: "Gate access, your account, and everything you need to come back on your own." },
];

const DEFAULT_AMBASSADOR = {
  heading: "Cuatro Smith",
  body: "Skip the form. Cuatro will walk you through the club in person, at a time that suits you.\n\nMembership Ambassador",
  imageUrl: "/properties/horseshoe-bay/img/cuatro-smith.jpg",
};

export default async function MembershipPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "horseshoe-bay");

  const [
    introOverride,
    pricingOverride,
    benefitsOverride,
    amenitiesOverride,
    spotlightOverride,
    stepsOverride,
    ambassadorOverride,
  ] = property
    ? await Promise.all([
        getPropertyPageSection(supabase, property.id, "membership", "intro"),
        getPropertyPageSection(supabase, property.id, "membership", "pricing"),
        getPropertyPageSection(supabase, property.id, "membership", "benefits"),
        getPropertyPageSection(supabase, property.id, "membership", "amenities"),
        getPropertyPageSection(supabase, property.id, "membership", "club-spotlight"),
        getPropertyPageSection(supabase, property.id, "membership", "onboarding-steps"),
        getPropertyPageSection(supabase, property.id, "membership", "ambassador"),
      ])
    : [null, null, null, null, null, null, null];

  const intro = {
    heading: introOverride?.heading || DEFAULT_INTRO.heading,
    body: introOverride?.body || DEFAULT_INTRO.body,
    ctaLabel: introOverride?.ctaLabel || DEFAULT_INTRO.ctaLabel,
    ctaHref: introOverride?.ctaHref || DEFAULT_INTRO.ctaHref,
    imageUrl: introOverride?.imageUrl || DEFAULT_INTRO.imageUrl,
  };
  const pricing = pricingOverride?.items?.length ? pricingOverride.items : DEFAULT_PRICING;
  const benefits = benefitsOverride?.items?.length ? benefitsOverride.items : DEFAULT_BENEFITS;
  const amenities = amenitiesOverride?.items?.length ? amenitiesOverride.items : DEFAULT_AMENITIES;
  const spotlight = {
    heading: spotlightOverride?.heading || DEFAULT_SPOTLIGHT.heading,
    body: spotlightOverride?.body || DEFAULT_SPOTLIGHT.body,
    images: spotlightOverride?.items?.length
      ? spotlightOverride.items.map((item, i) => ({ src: item.imageUrl ?? null, filename: DEFAULT_SPOTLIGHT.images[i]?.filename ?? "gallery.jpg" }))
      : DEFAULT_SPOTLIGHT.images.map((image) => ({ src: image.src as string | null, filename: image.filename })),
  };
  const onboardingSteps = stepsOverride?.items?.length ? stepsOverride.items : DEFAULT_ONBOARDING_STEPS;
  const ambassador = {
    heading: ambassadorOverride?.heading || DEFAULT_AMBASSADOR.heading,
    body: ambassadorOverride?.body || DEFAULT_AMBASSADOR.body,
    imageUrl: ambassadorOverride?.imageUrl || DEFAULT_AMBASSADOR.imageUrl,
  };
  const [ambassadorBlurb, ambassadorRole = "Membership Ambassador"] = ambassador.body.split("\n\n");

  return (
    <>
      <PageHero title="Membership" imageSrc={null} imageFilename="hero.jpg" />

      {/* Intro */}
      <Section>
        <div className="grid grid-cols-1 items-center gap-property-gutter md:grid-cols-2">
          <div className="flex flex-col items-start text-left">
            <SectionHeading eyebrow="Membership is Open" heading={intro.heading} />
            <p className="mb-8 whitespace-pre-wrap font-property-sans text-property-body-lg text-property-ink-variant">
              {intro.body}
            </p>
            {intro.ctaHref === "#inquiry" && property ? (
              <MembershipInquiryModal
                propertyId={property.id}
                triggerLabel={intro.ctaLabel}
                triggerVariant="ink"
              />
            ) : (
              <PropertyButton href={intro.ctaHref} variant="ink">
                {intro.ctaLabel}
              </PropertyButton>
            )}
          </div>
          <div className="relative aspect-[4/5] overflow-hidden border border-property-ink/10">
            <PropertyImage src={intro.imageUrl} alt="" filename="intro-membership.jpg" />
          </div>
        </div>
      </Section>

      {/* Pricing */}
      <Section tone="surface">
        <SectionHeading
          eyebrow="Welcome Home"
          heading="Sporting Club Membership"
          align="center"
          description="We are now welcoming members of the Club at Horseshoe Bay to join us on the range. Membership secures your place at the heart of the club, and invites you and your family to shape the future of our community. Please note: The Sporting Club is not open to the public."
          className="mx-auto max-w-3xl"
        />
        <div className="mx-auto mt-16 max-w-2xl border border-property-ink/15 bg-property-bg p-12 md:p-16">
          <div className="flex flex-col items-center justify-center gap-10 text-center sm:flex-row sm:gap-16">
            {pricing.map((figure, index) => (
              <Fragment key={figure.title ?? index}>
                {index > 0 && <div className="hidden h-20 w-px bg-property-ink/15 sm:block" />}
                <div>
                  <p className="font-property-display text-5xl leading-none text-property-ink md:text-6xl">{figure.title}</p>
                  <p className="mt-3 font-property-sans text-property-label uppercase tracking-widest text-property-accent-dark">
                    {figure.body}
                  </p>
                </div>
              </Fragment>
            ))}
          </div>
          <div className="mt-12 text-center">
            {property ? (
              <MembershipInquiryModal
                propertyId={property.id}
                triggerLabel="Reserve Your Place"
                triggerVariant="ink"
              />
            ) : (
              <PropertyButton href="#inquiry" variant="ink">
                Reserve Your Place
              </PropertyButton>
            )}
          </div>
        </div>
      </Section>

      {/* Benefits */}
      <Section>
        <SectionHeading
          eyebrow={<>What&rsquo;s Included</>}
          heading="Member Benefits"
          description="One membership, the whole club. Everything below is included for members and their guests, every time you come out."
          className="mb-16 max-w-2xl"
        />
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/5] overflow-hidden border border-property-ink/10">
            <PropertyImage src={null} alt="" filename="benefits.jpg" />
          </div>
          <div className="flex flex-col justify-center divide-y divide-property-ink/12">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-6 py-7">
                <div>
                  <h3 className="property-headline mb-2 font-property-display text-2xl uppercase leading-tight text-property-ink">
                    {benefit.title}
                  </h3>
                  <p className="font-property-sans text-property-ink-variant">{benefit.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Premier Amenities */}
      <Section>
        <SectionHeading
          eyebrow="Membership Includes"
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

      {/* Club Spotlight */}
      <SplitGallery
        eyebrow="Club Spotlight"
        title={spotlight.heading}
        description={spotlight.body}
        images={[
          { src: spotlight.images[0]?.src ?? null, alt: "The Last Shot Bar in the Trophy Room", filename: spotlight.images[0]?.filename ?? "gallery-1.jpg" },
          { src: spotlight.images[1]?.src ?? null, alt: "The Trophy Room bar and lounge", filename: spotlight.images[1]?.filename ?? "gallery-2.jpg" },
          { src: spotlight.images[2]?.src ?? null, alt: "Members at the Last Shot Bar after a round", filename: spotlight.images[2]?.filename ?? "gallery-3.jpg" },
        ]}
      />

      {/* Your First Visit */}
      <Section tone="surface" className="scroll-mt-32">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow="After You Join" heading="Your First Visit" />
            <p className="mb-8 max-w-xl font-property-sans text-property-body-lg leading-relaxed text-property-ink-variant">
              Every new member sits down with our Membership Ambassador before their first time on the
              range. It takes about an hour, you only ever do it once, and it is required before you
              shoot.
            </p>
            {property ? (
              <MembershipInquiryModal
                propertyId={property.id}
                triggerLabel="Schedule Onboarding"
                triggerVariant="primary"
              />
            ) : (
              <PropertyButton href="#inquiry" variant="primary">
                Schedule Onboarding
              </PropertyButton>
            )}
          </div>
          <div className="flex flex-col justify-center">
            {onboardingSteps.map((step, index) => (
              <div
                key={step.title ?? index}
                className={`flex gap-6 border-t border-property-ink/15 py-6 ${
                  index === onboardingSteps.length - 1 ? "border-b" : ""
                }`}
              >
                <span className="w-8 shrink-0 pt-1 font-property-sans text-[11px] uppercase tracking-[0.2em] text-property-accent-dark">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="property-headline mb-2 font-property-display text-[20px] uppercase text-property-ink">
                    {step.title}
                  </h3>
                  <p className="font-property-sans text-property-ink-variant">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Membership Inquiry */}
      <Section className="scroll-mt-32" id="inquiry">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <SectionHeading
              eyebrow="Horseshoe Bay Sporting Club"
              heading="Membership Inquiry"
              size="display"
              align="center"
            />
            <p className="mx-auto max-w-2xl font-property-sans text-[11px] uppercase leading-relaxed tracking-widest text-property-accent-dark">
              The Club at Horseshoe Bay members can now sign up for Sporting Club membership by
              contacting the Horseshoe Bay Membership Sales Team.
            </p>
          </div>

          <div className="mb-4 flex flex-col items-center gap-8 border border-property-ink/10 bg-property-surface/60 p-8 text-center md:flex-row md:text-left">
            <div className="relative size-32 shrink-0 overflow-hidden rounded-full">
              <PropertyImage src={ambassador.imageUrl} alt={ambassador.heading} filename="img/cuatro-smith.jpg" />
            </div>
            <div className="flex-1">
              <h3 className="property-headline mb-1 font-property-display text-2xl uppercase text-property-ink">
                Ready to Tour?
              </h3>
              <p className="mb-3 font-property-sans text-property-ink-variant">{ambassadorBlurb}</p>
              <p className="font-property-sans text-[11px] uppercase tracking-[0.2em] text-property-accent-dark">
                {ambassador.heading} &middot; {ambassadorRole}
              </p>
            </div>
            {property ? (
              <MembershipInquiryModal
                propertyId={property.id}
                triggerLabel="Schedule a Tour"
                triggerVariant="ink"
                triggerClassName="shrink-0 whitespace-nowrap"
              />
            ) : (
              <PropertyButton href="#inquiry" variant="ink" className="shrink-0 whitespace-nowrap">
                Schedule a Tour
              </PropertyButton>
            )}
          </div>
          <p className="mb-12 text-center font-property-sans text-sm text-property-ink-variant/80 md:text-left">
            Prefer to explore on your own first?{" "}
            <a
              href="https://tours.covecreekproductions.com/horseshoe-bay/#/category/11"
              target="_blank"
              rel="noopener noreferrer"
              className="text-property-ink underline decoration-property-accent decoration-2 underline-offset-4 transition-colors hover:text-property-ink-dark"
            >
              Take a virtual tour
            </a>
            .
          </p>

          {property && <MembershipInquiryForm propertyId={property.id} />}
        </div>
      </Section>
    </>
  );
}
