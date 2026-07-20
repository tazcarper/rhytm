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
  heading: "Join the Club",
  body: "Hog Heaven is the destination for those who demand excellence in their outdoor pursuits. Built around an unwavering commitment to craft and community, the club is designed for members who want their passion for the outdoors woven into daily life, not saved for the rare free weekend.\n\nSet against the natural beauty of the Texas Hill Country, Hog Heaven is where we meet, practice our craft, and push ourselves to grow. It is where families connect and community thrives.\n\nSporting club memberships are intentionally limited. Not only to protect our facility and landscape, but to preserve the integrity of why we are here: to grow and connect in nature.",
  ctaLabel: "Request Membership Info",
  ctaHref: "#inquiry",
  imageUrl: null as string | null,
};

// Four named family tiers plus a full-width corporate tier — a shape the
// existing `membership`/`pricing` CMS section (title=number, body=label,
// built for Horseshoe Bay's flat two-figure pricing) doesn't fit. Rather
// than stretch that config to cover a fourth text field per tier (name +
// blurb + two prices + coverage copy), this is static page content for
// now — see plan/frontend/hog-heaven-remaining-pages.md's Membership
// section for the tradeoff. Flag for a future admin-config pass if these
// need to become client-editable.
const FAMILY_TIERS = [
  {
    name: "Legacy Family",
    blurb: "Inheritable premier plan that includes children and grandchildren. This plan secures membership for your future generations with a single initiation fee.",
    initiation: "$8,500",
    monthly: "$325 / month",
    coverage: "Covers spouse, children, adult children, and grandchildren. Can be passed down through a trust or to children.",
  },
  {
    name: "Household",
    blurb: "A complete membership for immediate family for the years your kids are still under your roof. Easy to upgrade when the household grows.",
    initiation: "$5,950",
    monthly: "$295 / month",
    coverage: "Covers spouse and children under 18. Adult children and grandchildren are not included. Not eligible for inheritance or transfer.",
  },
  {
    name: "Individual",
    blurb: "Solo membership with full access to everything the club has to offer, with the ability to bring guests whenever desired.",
    initiation: "$3,450",
    monthly: "$195 / month",
    coverage: "Single member only. Family members are classified as guests.",
  },
  {
    name: "Out of State",
    blurb: "All the benefits of our Household membership, in a pricing plan designed for those with a second home in Texas.",
    initiation: "$3,450",
    monthly: "$195 / month",
    coverage: "Covers spouse and children under 18. Proof of out-of-state residence required. Not eligible for inheritance or transfer.",
  },
];

const CORPORATE_TIER = {
  blurb: "A plan for your leadership team that earns its keep. Scales as your team does.",
  initiation: "$12,500",
  monthly: "+ $750 / month for up to 5 executives",
  included: [
    "5 executives included, with the option to add more",
    "All of the on-site benefits as our Individual plan",
    "Unlimited number of guests with a low $50 guest fee",
    "15% discount on all events",
    "One free executive training retreat per year",
  ],
};

const DEFAULT_BENEFITS = [
  { title: "Every Discipline", body: "Shotgun, pistol, archery, and the stocked lake, all included with membership. Golf cart rentals too." },
  { title: "Access On Your Schedule", body: "8 AM to 8 PM, seven days a week. Bring guests whenever you like for a $50 day fee." },
  { title: "Training Included", body: "Hog Heaven PT comes with premier plans. Private lessons and training classes at member pricing." },
  { title: "Retail Discounts", body: "$.39 clay targets, plus discounts on ammo, retail, and private events." },
];

const DEFAULT_AMENITIES = [
  {
    title: "Shotgun",
    body: "Sporting clays course wrapping around the lake, plus skeet, trap, and 5-stand.",
    bullets: ["12 sporting clays stations", "4 trap and skeet fields", "5 station super sporting course", "Two 5-stands"],
    imageUrl: null as string | null,
  },
  {
    title: "Pistol & Carbine",
    body: "Nine outdoor bays with interactive steel and paper targets, and instruction at every level.",
    bullets: ["9 pistol and carbine bays", "Interactive steel and paper targets", "Lessons from working pros"],
    imageUrl: null as string | null,
  },
  {
    title: "Archery & The Lake",
    body: "A 3D archery gallery and a spring-fed lake stocked and structured for real fishing.",
    bullets: [
      "3D gallery with Texas native and big game targets",
      "15-acre stocked lake, 200+ underwater habitat structures",
      "Bass, bluegill, and catfish",
    ],
    imageUrl: null as string | null,
  },
];

const DEFAULT_SPOTLIGHT = {
  heading: "The Party Bridge",
  body: "An event bridge over the lake. Dinners, gatherings, and the kind of evenings people talk about later.",
  images: [
    { src: null as string | null, filename: "img/clublife-1.jpg" },
    { src: null as string | null, filename: "img/clublife-2.jpg" },
    { src: null as string | null, filename: "img/clublife-3.jpg" },
  ],
};

const DEFAULT_ONBOARDING_STEPS = [
  { title: "Safety and the Rules", body: "Firearm handling standards, range etiquette, and what is and is not allowed where." },
  { title: "A Walk of the Property", body: "Where everything is, how to check in, and how the day actually works." },
  { title: "Your Access", body: "Gate access, your account, and everything you need to come back on your own." },
];

const DEFAULT_AMBASSADOR = {
  heading: "Georgia Stone",
  body: "Skip the form. Georgia will walk you through the club in person, at a time that suits you.\n\nMembership Director",
  imageUrl: null as string | null,
};

export default async function HogHeavenMembershipPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "hog-heaven");

  const [introOverride, benefitsOverride, amenitiesOverride, spotlightOverride, stepsOverride, ambassadorOverride] =
    property
      ? await Promise.all([
          getPropertyPageSection(supabase, property.id, "membership", "intro"),
          getPropertyPageSection(supabase, property.id, "membership", "benefits"),
          getPropertyPageSection(supabase, property.id, "membership", "amenities"),
          getPropertyPageSection(supabase, property.id, "membership", "club-spotlight"),
          getPropertyPageSection(supabase, property.id, "membership", "onboarding-steps"),
          getPropertyPageSection(supabase, property.id, "membership", "ambassador"),
        ])
      : [null, null, null, null, null, null];

  const intro = {
    heading: introOverride?.heading || DEFAULT_INTRO.heading,
    body: introOverride?.body || DEFAULT_INTRO.body,
    ctaLabel: introOverride?.ctaLabel || DEFAULT_INTRO.ctaLabel,
    ctaHref: introOverride?.ctaHref || DEFAULT_INTRO.ctaHref,
    imageUrl: introOverride?.imageUrl || DEFAULT_INTRO.imageUrl,
  };
  const benefits = benefitsOverride?.items?.length ? benefitsOverride.items : DEFAULT_BENEFITS;
  const amenities = amenitiesOverride?.items?.length ? amenitiesOverride.items : DEFAULT_AMENITIES;
  const spotlight = {
    heading: spotlightOverride?.heading || DEFAULT_SPOTLIGHT.heading,
    body: spotlightOverride?.body || DEFAULT_SPOTLIGHT.body,
    images: spotlightOverride?.items?.length
      ? spotlightOverride.items.map((item, i) => ({ src: item.imageUrl ?? null, filename: DEFAULT_SPOTLIGHT.images[i]?.filename ?? "gallery.jpg" }))
      : DEFAULT_SPOTLIGHT.images,
  };
  const onboardingSteps = stepsOverride?.items?.length ? stepsOverride.items : DEFAULT_ONBOARDING_STEPS;
  const ambassador = {
    heading: ambassadorOverride?.heading || DEFAULT_AMBASSADOR.heading,
    body: ambassadorOverride?.body || DEFAULT_AMBASSADOR.body,
    imageUrl: ambassadorOverride?.imageUrl || DEFAULT_AMBASSADOR.imageUrl,
  };
  const [ambassadorBlurb, ambassadorRole = "Membership Director"] = ambassador.body.split("\n\n");

  return (
    <>
      <PageHero title="Membership" imageSrc={null} imageFilename="hero-membership.jpg" />

      {/* Intro */}
      <Section>
        <div className="grid grid-cols-1 items-center gap-property-gutter md:grid-cols-2">
          <div className="flex flex-col items-start text-left">
            <SectionHeading heading={intro.heading} />
            <p className="mb-8 whitespace-pre-wrap font-property-sans text-property-body-lg text-property-ink-variant">
              {intro.body}
            </p>
            {intro.ctaHref === "#inquiry" && property ? (
              <MembershipInquiryModal
                propertyId={property.id}
                triggerLabel={intro.ctaLabel}
                triggerVariant="primary"
                showHearAboutUs
                submitVariant="primary"
                sourceLabel="Membership Intro"
              />
            ) : (
              <PropertyButton href={intro.ctaHref} variant="primary">
                {intro.ctaLabel}
              </PropertyButton>
            )}
          </div>
          <div className="relative aspect-[4/5] overflow-hidden border border-property-ink/10">
            <PropertyImage src={intro.imageUrl} alt="" filename="intro-membership.jpg" />
          </div>
        </div>
      </Section>

      {/* Membership tiers */}
      <Section tone="surfaceHighest">
        <SectionHeading
          heading="Sporting Club Membership"
          align="center"
          description={
            <>
              We offer membership tiers designed to fit where you are in life. Solo members get full
              access on their own schedule. Families can choose between a household plan built for the
              years your kids are still at home, or a legacy tier that can be passed down through
              generations. For businesses, the corporate membership gives your leadership team a shared
              place that becomes part of your company culture.
              <span className="mt-6 block font-property-sans text-property-label uppercase tracking-widest text-property-ink-variant/85">
                Military / law enforcement discounts available.
              </span>
            </>
          }
          className="mx-auto mb-16 max-w-3xl"
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FAMILY_TIERS.map((tier) => (
            <div
              key={tier.name}
              className="flex h-full flex-col border border-property-ink/5 bg-property-bg p-8 transition-all duration-500 hover:border-property-accent"
            >
              <h3 className="property-display mb-3 font-property-display text-3xl uppercase text-property-ink">
                {tier.name}
              </h3>
              <p className="mb-6 min-h-[7.5em] font-property-sans text-sm text-property-ink-variant">{tier.blurb}</p>
              <div className="mb-6">
                <div className="mb-1 flex items-end gap-2">
                  <span className="property-display font-property-display text-4xl text-property-ink">
                    {tier.initiation}
                  </span>
                  <span className="pb-1 font-property-sans text-[11px] uppercase text-property-accent-dark">
                    Initiation
                  </span>
                </div>
                <p className="font-property-sans text-property-ink-variant">{tier.monthly}</p>
              </div>
              <p className="mb-8 min-h-[8.5em] border-t border-property-ink/10 pt-6 font-property-sans text-[11px] uppercase leading-relaxed tracking-wide text-property-ink-variant/85">
                {tier.coverage}
              </p>
              {property ? (
                <MembershipInquiryModal
                  propertyId={property.id}
                  triggerLabel="Inquire"
                  triggerVariant="primary"
                  triggerSize="sm"
                  triggerClassName="mt-auto w-full"
                  showHearAboutUs
                  submitVariant="primary"
                  sourceLabel={tier.name}
                />
              ) : (
                <PropertyButton href="#inquiry" variant="primary" size="sm" className="mt-auto w-full">
                  Inquire
                </PropertyButton>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 border border-property-ink/10 bg-property-bg">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="flex flex-col border-b border-property-ink/10 p-10 md:border-b-0 md:border-r md:p-14">
              <h3 className="property-display mb-3 font-property-display text-4xl uppercase text-property-ink">
                Corporate
              </h3>
              <p className="mb-8 max-w-md font-property-sans text-property-ink-variant">{CORPORATE_TIER.blurb}</p>
              <div className="mb-1 flex items-end gap-2">
                <span className="property-display font-property-display text-5xl text-property-ink">
                  {CORPORATE_TIER.initiation}
                </span>
                <span className="pb-1 font-property-sans text-[11px] uppercase text-property-accent-dark">
                  Initiation
                </span>
              </div>
              <p className="mb-8 font-property-sans text-property-ink-variant">{CORPORATE_TIER.monthly}</p>
              {property ? (
                <MembershipInquiryModal
                  propertyId={property.id}
                  triggerLabel="Inquire"
                  triggerVariant="primary"
                  triggerClassName="mt-auto self-start"
                  showHearAboutUs
                  submitVariant="primary"
                  sourceLabel="Corporate Membership"
                />
              ) : (
                <PropertyButton href="#inquiry" variant="primary" className="mt-auto self-start">
                  Inquire
                </PropertyButton>
              )}
            </div>
            <div className="p-10 md:p-14">
              <p className="mb-4 font-property-sans text-[11px] uppercase tracking-widest text-property-ink-variant/85">
                What&rsquo;s included
              </p>
              <div>
                {CORPORATE_TIER.included.map((item, index) => (
                  <div
                    key={item}
                    className={`flex items-center gap-3 py-3 font-property-sans text-sm text-property-ink ${
                      index < CORPORATE_TIER.included.length - 1 ? "border-b border-property-ink/10" : ""
                    }`}
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-property-accent" aria-hidden />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Member Benefits */}
      <Section>
        <SectionHeading heading="Member Benefits" className="mb-16" />
        <div className="grid grid-cols-1 border border-property-ink/10 md:grid-cols-4">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className={`p-12 ${
                index < benefits.length - 1 ? "border-b border-property-ink/10 md:border-b-0 md:border-r" : ""
              }`}
            >
              <h3 className="property-headline mb-4 font-property-display text-2xl uppercase text-property-ink">
                {benefit.title}
              </h3>
              <p className="font-property-sans text-property-ink-variant">{benefit.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Facilities / Offerings */}
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

      {/* Club Life feature — The Party Bridge */}
      <SplitGallery
        eyebrow="Social Setting"
        title={spotlight.heading}
        description={spotlight.body}
        images={[
          { src: spotlight.images[0]?.src ?? null, alt: "The Party Bridge at Hog Heaven, a covered timber event bridge over the lake", filename: spotlight.images[0]?.filename ?? "gallery-1.jpg" },
          { src: spotlight.images[1]?.src ?? null, alt: "The Party Bridge set for an evening event", filename: spotlight.images[1]?.filename ?? "gallery-2.jpg" },
          { src: spotlight.images[2]?.src ?? null, alt: "The Party Bridge at dusk over the lake", filename: spotlight.images[2]?.filename ?? "gallery-3.jpg" },
        ]}
      />

      {/* Your First Visit */}
      <Section tone="surface" className="scroll-mt-32">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow="After You Join" heading="Your First Visit" />
            <p className="mb-8 max-w-xl font-property-sans text-property-body-lg leading-relaxed text-property-ink-variant">
              Every new member sits down with our membership director before their first time on the
              range. It takes about an hour, you only ever do it once, and it is required before you
              shoot.
            </p>
            {property ? (
              <MembershipInquiryModal
                propertyId={property.id}
                triggerLabel="Schedule Onboarding"
                triggerVariant="primary"
                showHearAboutUs
                submitVariant="primary"
                sourceLabel="Schedule Onboarding"
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
            <SectionHeading eyebrow="Hog Heaven Sporting Club" heading="Membership Inquiry" size="display" align="center" />
            <p className="mx-auto max-w-2xl font-property-sans text-[11px] uppercase leading-relaxed tracking-widest text-property-accent-dark">
              Learn more about membership and schedule a tour of the club facilities, amenities, and
              activities.
            </p>
          </div>

          <div className="mb-12 flex flex-col items-center gap-8 border border-property-ink/10 bg-property-surface/60 p-8 text-center md:flex-row md:text-left">
            <div className="relative size-32 shrink-0 overflow-hidden rounded-full">
              <PropertyImage src={ambassador.imageUrl} alt={ambassador.heading} filename="img/georgia-stone.jpg" />
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
                triggerVariant="primary"
                triggerClassName="shrink-0 whitespace-nowrap"
                showHearAboutUs
                submitVariant="primary"
                sourceLabel="Schedule a Tour"
              />
            ) : (
              <PropertyButton href="#inquiry" variant="primary" className="shrink-0 whitespace-nowrap">
                Schedule a Tour
              </PropertyButton>
            )}
          </div>

          {property && (
            <MembershipInquiryForm
              propertyId={property.id}
              showHearAboutUs
              submitVariant="primary"
              sourceLabel="Membership Inquiry Form"
            />
          )}
        </div>
      </Section>
    </>
  );
}
