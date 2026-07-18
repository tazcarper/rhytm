import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicPropertyBySlug } from "@/src/services/public/properties";
import { getPropertyPageSection } from "@/src/services/public/property-page-content";
import { Section } from "@/src/components/public/property-template/section";
import { SectionHeading } from "@/src/components/public/property-template/section-heading";
import { PropertyImage } from "@/src/components/public/property-template/property-image";
import { PropertyButton } from "@/src/components/public/property-template/property-button";
import { PageHero } from "@/src/components/public/property-template/page-hero";
import { OccasionCard } from "@/src/components/public/property-template/occasion-card";
import { SplitGallery } from "@/src/components/public/property-template/split-gallery";
import { PrivateEventInquiryForm } from "@/src/components/public/property-template/private-event-inquiry-form";

export const dynamic = "force-dynamic";

const DEFAULT_INTRO = {
  heading: "Book Your Event",
  body: "Looking for a one-of-a-kind event venue in the Texas Hill Country? Hog Heaven Sporting Club in Dripping Springs is the right place for private events of all sizes. We have hosted everyone from small businesses to names like Red Bull Racing, Ducks Unlimited, and Texas Parks and Wildlife.\n\nWhether you are planning a corporate shoot, a fundraiser, or a team-building day, we are here to make it go well. Guests can enjoy sporting clays, skeet and trap, fishing, and our pistol range, all in a stunning outdoor setting. Afterward, your group can gather on the pavilion or the Party Bridge for refreshments, dinner, and live entertainment. Our team helps with catering, entertainment, and anything else you need.",
  ctaLabel: "Submit Event Inquiry",
  ctaHref: "#inquiry",
  imageUrl: null as string | null,
};

const DEFAULT_OCCASIONS = [
  { title: "Corporate & Team Building", body: "Company shoots, retreats, board meetings, and leadership days. Take the clays course, the skeet and trap fields, the 5-stand, and the pistol bays, or bring the whole office out for a day in the field.", imageUrl: null as string | null },
  { title: "Charity & Fundraising Shoots", body: "We host many charity clay shoots each year, and we are a natural fit for your non-profit's fundraising event.", imageUrl: null as string | null },
  { title: "Private Parties & Gatherings", body: "Birthdays, bachelor and bridal parties, dinners on the Party Bridge, reunions, and much more.", imageUrl: null as string | null },
  { title: "Weddings & Wedding Parties", body: "Hog Heaven offers several picturesque settings for your ceremony, your reception, and the days around them.", imageUrl: null as string | null },
];

const DEFAULT_SERVICES = [
  { title: "The Range", body: "Sporting clays, skeet and trap, 5-stand, and the pistol bays. Instructors and gear for every skill level, first-timers included.", bullets: ["Capacity and layout vary by space — our team will walk you through the options", "Sporting clays, skeet and trap, 5-stand", "Pistol bays and fishing on the lake"] },
  { title: "Food & Drink", body: "Catering on the pavilion or dinner out on the Party Bridge, with refreshments through the day and live entertainment if you want it.", bullets: ["Instruction and gear for every level", "Catering on the pavilion", "Dinner on the Party Bridge"] },
  { title: "The Details", body: "Planning, coordination, and on-site staff. We have hosted everyone from small businesses to Red Bull Racing, Ducks Unlimited, and Texas Parks and Wildlife.", bullets: ["Live entertainment on request", "Planning and coordination", "On-site staff all day"] },
];

const DEFAULT_SETTING = {
  heading: "120+ Acres To Play With",
  body: "The clays course, the skeet and trap fields, the pistol bays, and the lake. When the shooting is done, the pavilion and the Party Bridge are waiting for refreshments, dinner, and live entertainment.",
  images: [
    { src: null as string | null, filename: "img/venue-1.jpg" },
    { src: null as string | null, filename: "img/venue-2.jpg" },
    { src: null as string | null, filename: "img/venue-3.jpg" },
  ],
};

export default async function HogHeavenPrivateEventsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "hog-heaven");

  const [introOverride, occasionsOverride, servicesOverride, settingOverride] = property
    ? await Promise.all([
        getPropertyPageSection(supabase, property.id, "private_events", "intro"),
        getPropertyPageSection(supabase, property.id, "private_events", "occasions"),
        getPropertyPageSection(supabase, property.id, "private_events", "services"),
        getPropertyPageSection(supabase, property.id, "private_events", "setting-gallery"),
      ])
    : [null, null, null, null];

  const intro = {
    heading: introOverride?.heading || DEFAULT_INTRO.heading,
    body: introOverride?.body || DEFAULT_INTRO.body,
    ctaLabel: introOverride?.ctaLabel || DEFAULT_INTRO.ctaLabel,
    ctaHref: introOverride?.ctaHref || DEFAULT_INTRO.ctaHref,
    imageUrl: introOverride?.imageUrl || DEFAULT_INTRO.imageUrl,
  };
  const occasions = occasionsOverride?.items?.length ? occasionsOverride.items : DEFAULT_OCCASIONS;
  const services = servicesOverride?.items?.length ? servicesOverride.items : DEFAULT_SERVICES;
  const setting = {
    heading: settingOverride?.heading || DEFAULT_SETTING.heading,
    body: settingOverride?.body || DEFAULT_SETTING.body,
    images: settingOverride?.items?.length
      ? settingOverride.items.map((item, i) => ({ src: item.imageUrl ?? null, filename: DEFAULT_SETTING.images[i]?.filename ?? "gallery.jpg" }))
      : DEFAULT_SETTING.images,
  };

  return (
    <>
      <PageHero title="Private Events" imageSrc={null} imageFilename="hero-private-events.jpg" />

      {/* Intro / Book Your Event */}
      <Section>
        <div className="grid grid-cols-1 items-center gap-property-gutter md:grid-cols-2">
          <div className="flex flex-col items-start text-left">
            <SectionHeading heading={intro.heading} />
            <p className="mb-8 whitespace-pre-wrap font-property-sans text-property-body-lg text-property-ink-variant">
              {intro.body}
            </p>
            <PropertyButton href={intro.ctaHref} variant="primary">
              {intro.ctaLabel}
            </PropertyButton>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden border border-property-ink/10">
            <PropertyImage src={intro.imageUrl} alt="" filename="intro-private-events.jpg" />
          </div>
        </div>
      </Section>

      {/* Events We Host */}
      <Section tone="surfaceHighest" className="border-y border-property-ink/10">
        <SectionHeading heading="Events We Host" align="center" className="mb-16" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {occasions.map((occasion) => (
            <OccasionCard
              key={occasion.title}
              title={occasion.title ?? ""}
              blurb={occasion.body ?? ""}
              imageSrc={occasion.imageUrl ?? null}
              imageFilename="occasion.jpg"
            />
          ))}
        </div>
      </Section>

      {/* What's Included */}
      <Section>
        <SectionHeading eyebrow="What We Handle" heading={<>What&rsquo;s Included</>} className="mb-12 max-w-2xl" />
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {services.map((service) => (
            <div key={service.title} className="space-y-6">
              <h3 className="font-property-sans text-xl uppercase tracking-wider text-property-ink">
                {service.title}
              </h3>
              <p className="font-property-sans text-property-ink-variant">{service.body}</p>
              <ul className="space-y-2 font-property-sans text-xs uppercase text-property-ink/60">
                {(service.bullets ?? []).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* The Setting */}
      <SplitGallery
        eyebrow="The Setting"
        title={setting.heading}
        description={setting.body}
        images={[
          { src: setting.images[0]?.src ?? null, alt: "A private event at Hog Heaven Sporting Club", filename: setting.images[0]?.filename ?? "gallery-1.jpg" },
          { src: setting.images[1]?.src ?? null, alt: "A group gathered on the pavilion", filename: setting.images[1]?.filename ?? "gallery-2.jpg" },
          { src: setting.images[2]?.src ?? null, alt: "An evening on the Party Bridge", filename: setting.images[2]?.filename ?? "gallery-3.jpg" },
        ]}
      />

      {/* Inquiry */}
      <Section className="border-t border-property-ink/10 scroll-mt-32" id="inquiry">
        <div className="mx-auto max-w-[800px]">
          <SectionHeading
            heading="Request a Proposal"
            align="center"
            description="Tell us about your group and your date, and our team will follow up to build the day around it."
            className="mb-16"
          />
          {property && <PrivateEventInquiryForm propertyId={property.id} submitVariant="primary" />}
        </div>
      </Section>
    </>
  );
}
