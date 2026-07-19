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
  heading: "How Membership Works",
  body: "A members-only club for people who want training, authenticity, and community. Individual, Family, or Corporate, each at two tiers, sized to fit how you'll use the mountain.",
  ctaLabel: "Request Membership Info",
  ctaHref: "#inquiry",
  imageUrl: null as string | null,
};

// Three membership types, each at two price points (Founding Member vs.
// Standard) — a third, different tier shape than either Horseshoe Bay's
// flat two-figure pricing or Hog Heaven's four-tier-plus-corporate/coverage
// shape. Each price point is itself two numbers in the mockup — an
// initiation figure plus a "/ [$000] mo" monthly figure — not a single
// number. All still literal bracket placeholders; no real pricing exists
// yet, not invented here. Static page content, same precedent as Hog
// Heaven's tiers (doesn't fit the existing "pricing" CMS section without
// extending the admin type system) — see
// plan/frontend/packsaddle-remaining-pages.md.
const MEMBERSHIP_TIERS = [
  {
    name: "Individual",
    blurb: "For a solo member who wants full access to training and the range.",
    founding: { initiation: "[$0,000]", monthly: "[$000]" },
    standard: { initiation: "[$0,000]", monthly: "[$000]" },
  },
  {
    name: "Family",
    blurb: "For a household that trains and shoots together.",
    founding: { initiation: "[$0,000]", monthly: "[$000]" },
    standard: { initiation: "[$0,000]", monthly: "[$000]" },
  },
  {
    name: "Corporate",
    blurb: "For a leadership team building culture through training.",
    founding: { initiation: "[$0,000]", monthly: "[$000]" },
    standard: { initiation: "[$0,000]", monthly: "[$000]" },
  },
];

const DEFAULT_BENEFITS = [
  { title: "Unlimited Range Access", body: "Shoot the ≈3,750-yard range whenever you're on the mountain." },
  { title: "On-Site Food & Water", body: "Fed and watered through every session, no packing required." },
  { title: "Post-Shoot Whiskey", body: "A pour and good company at the lodge when the shooting's done." },
  { title: "Expert Instruction", body: "Precision rifle, carbine, pistol, and fieldcraft, taught by people who do it." },
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

const DEFAULT_SPOTLIGHT = {
  heading: "The Lodge",
  body: "Where the fire never goes out and the day winds down, with good people and a pour to close things out.",
  images: [
    { src: null as string | null, filename: "img/clublife-1.jpg" },
    { src: null as string | null, filename: "img/clublife-2.jpg" },
    { src: null as string | null, filename: "img/clublife-3.jpg" },
  ],
};

export default async function PacksaddleMembershipPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "packsaddle");

  const [introOverride, benefitsOverride, amenitiesOverride, spotlightOverride] = property
    ? await Promise.all([
        getPropertyPageSection(supabase, property.id, "membership", "intro"),
        getPropertyPageSection(supabase, property.id, "membership", "benefits"),
        getPropertyPageSection(supabase, property.id, "membership", "amenities"),
        getPropertyPageSection(supabase, property.id, "membership", "club-spotlight"),
      ])
    : [null, null, null, null];

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

      {/* Membership tiers — mockup uses bg-surface-container (property-surface),
          not the -highest variant. */}
      <Section tone="surface">
        <SectionHeading
          heading="Membership"
          align="center"
          description={
            <>
              A members-only club for people who want training, authenticity, and community. Three
              membership types, each at two tiers, sized to fit how you&rsquo;ll use the mountain.
              <span className="mt-6 block font-property-label text-property-label uppercase tracking-widest text-property-accent-dark">
                Founding Members lock in their rate for life, plus early-cohort perks.
              </span>
            </>
          }
          className="mx-auto mb-16 max-w-3xl"
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {MEMBERSHIP_TIERS.map((tier) => (
            <div
              key={tier.name}
              className="flex h-full flex-col border border-property-ink/5 bg-property-bg p-8 transition-all duration-500 hover:border-property-accent"
            >
              <h3 className="property-display mb-3 font-property-display text-3xl uppercase text-property-ink">
                {tier.name}
              </h3>
              <p className="mb-6 min-h-[7.5em] font-property-sans text-sm text-property-ink-variant">{tier.blurb}</p>
              <div className="mt-auto space-y-4 border-t border-property-ink/10 pt-6">
                <div>
                  <p className="mb-1 font-property-label text-[11px] uppercase tracking-wide text-property-accent-dark">
                    Founding Member
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="property-display font-property-display text-3xl text-property-ink">
                      {tier.founding.initiation}
                    </span>
                    <span className="font-property-sans text-property-ink-variant">/ {tier.founding.monthly} mo</span>
                  </div>
                </div>
                <div>
                  <p className="mb-1 font-property-label text-[11px] uppercase tracking-wide text-property-accent-dark">
                    Standard
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="property-display font-property-display text-2xl text-property-ink-variant">
                      {tier.standard.initiation}
                    </span>
                    <span className="font-property-sans text-property-ink-variant">/ {tier.standard.monthly} mo</span>
                  </div>
                </div>
              </div>
              {property ? (
                <MembershipInquiryModal
                  propertyId={property.id}
                  triggerLabel="Inquire"
                  triggerVariant="primary"
                  triggerClassName="mt-8 w-full"
                  showHearAboutUs
                  submitVariant="primary"
                />
              ) : (
                <PropertyButton href="#inquiry" variant="primary" className="mt-8 w-full">
                  Inquire
                </PropertyButton>
              )}
            </div>
          ))}
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

      {/* Facilities / Offerings — mirrors the homepage's "What We Offer" */}
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

      {/* Club Life feature — The Lodge */}
      <SplitGallery
        eyebrow="Club Life"
        title={spotlight.heading}
        description={spotlight.body}
        images={[
          { src: spotlight.images[0]?.src ?? null, alt: "The Lodge at Packsaddle Precision", filename: spotlight.images[0]?.filename ?? "gallery-1.jpg" },
          { src: spotlight.images[1]?.src ?? null, alt: "The Lodge fireplace and common room", filename: spotlight.images[1]?.filename ?? "gallery-2.jpg" },
          { src: spotlight.images[2]?.src ?? null, alt: "The Lodge at last light", filename: spotlight.images[2]?.filename ?? "gallery-3.jpg" },
        ]}
      />

      {/* Membership Inquiry */}
      <Section className="scroll-mt-32" id="inquiry">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <SectionHeading eyebrow="Packsaddle Precision" heading="Membership Inquiry" size="display" align="center" />
            <p className="mx-auto max-w-2xl font-property-label text-[11px] uppercase leading-relaxed tracking-widest text-property-accent-dark">
              Learn more about membership and schedule a tour of the club facilities, amenities, and
              activities.
            </p>
          </div>

          {/* Skip-the-form shortcut. No ambassador photo/name in this
              mockup (unlike Horseshoe Bay's and Hog Heaven's), so this is
              plain heading + blurb + button, not the ambassador config
              shape those two properties use. */}
          <div className="mb-12 flex flex-col items-center gap-6 border border-property-ink/10 bg-property-surface/60 p-8 text-center md:flex-row md:justify-between md:text-left">
            <div>
              <h3 className="property-headline mb-1 font-property-display text-2xl uppercase text-property-ink">
                Ready to Tour?
              </h3>
              <p className="font-property-sans text-property-ink-variant">
                Skip the form and schedule your private tour with a Membership Ambassador.
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
              />
            ) : (
              <PropertyButton href="#inquiry" variant="primary" className="shrink-0 whitespace-nowrap">
                Schedule a Tour
              </PropertyButton>
            )}
          </div>

          {property && <MembershipInquiryForm propertyId={property.id} showHearAboutUs submitVariant="primary" />}
        </div>
      </Section>
    </>
  );
}
