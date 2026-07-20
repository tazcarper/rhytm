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
  heading: "Host Your Event",
  body: "Set within 150+ acres of rolling Hill Country, Horseshoe Bay Sporting Club is a rare setting for a private gathering. Groups enjoy an outing on the range then gather in the Trophy Room to eat, drink, and make lasting memories.\n\nGroup and corporate bookings are the one lane where guests of the Horseshoe Bay Resort community join us. Our team handles the shooting, instruction, food & beverage, and the details around them, so your group can simply show up and enjoy the day.",
  ctaLabel: "Submit Event Inquiry",
  ctaHref: "#inquiry",
  imageUrl: "/properties/horseshoe-bay/intro-private-events.jpg",
};

const DEFAULT_OCCASIONS = [
  { title: "Corporate & Group Shoots", body: "Bring your company to the sporting clays course, the shooting decks, and the pistol bays, with instructors on hand for every skill level.", imageUrl: "/properties/horseshoe-bay/host-corporate-group-shoots.jpg" },
  { title: "Charity & Fundraising Shoots", body: "A memorable setting for a non-profit clay shoot, with our team behind your cause.", imageUrl: "/properties/horseshoe-bay/host-charity-fundraising-shoots.jpg" },
  { title: "Retreats & Meetings", body: "Utilizes our private conference room and meeting spaces, with time on the range to open or close the day.", imageUrl: "/properties/horseshoe-bay/host-retreats-meetings.jpg" },
  { title: "Private Parties & Celebrations", body: "The Trophy Room, The Last Shot bar, and the shaded patio make natural homes for celebration.", imageUrl: "/properties/horseshoe-bay/host-private-parties-celebrations.jpg" },
];

const DEFAULT_SERVICES = [
  { title: "The Range", body: "Guided shooting for every skill level, instruction and gear included.", bullets: ["Sporting clays and 5-Stand", "Pistol bays", "All skill levels"] },
  { title: "The Clubhouse", body: "Lounge, Trophy Room, and The Last Shot bar for gathering before and after.", bullets: ["Food and beverage", "The Last Shot bar", "Deck over the course"] },
  { title: "The Details", body: "We handle the logistics so your group just shows up.", bullets: ["Planning and coordination", "On-site staff", "Custom to your group"] },
];

const DEFAULT_SETTING = {
  heading: "150+ Acres Of Rolling Hill Country",
  body: "Book time on the sporting clays course, flurry deck, and pistol bays. Afterward, meet in the clubhouse and Trophy Room to celebrate, network, or simply relax.",
  images: [
    { src: "/properties/horseshoe-bay/img/venue-1.jpg", filename: "img/venue-1.jpg" },
    { src: "/properties/horseshoe-bay/img/venue-2.jpg", filename: "img/venue-2.jpg" },
    { src: "/properties/horseshoe-bay/img/venue-3.jpg", filename: "img/venue-3.jpg" },
  ],
};

export default async function PrivateEventsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: property } = await getPublicPropertyBySlug(supabase, "horseshoe-bay");

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
      : DEFAULT_SETTING.images.map((image) => ({ src: image.src as string | null, filename: image.filename })),
  };

  return (
    <>
      <PageHero title="Private Events" imageSrc={null} imageFilename="hero-private-events.jpg" />

      {/* Intro */}
      <Section>
        <div className="grid grid-cols-1 items-center gap-property-gutter md:grid-cols-2">
          <div className="flex flex-col items-start text-left">
            <SectionHeading eyebrow="Private Events" heading={intro.heading} />
            <p className="mb-8 whitespace-pre-wrap font-property-sans text-property-body-lg text-property-ink-variant">
              {intro.body}
            </p>
            <PropertyButton href={intro.ctaHref} variant="ink">
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
        <SectionHeading eyebrow="Occasions" heading="Events We Host" align="center" className="mb-16" />
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

      {/* Services */}
      <Section>
        <SectionHeading eyebrow="Services" heading={<>What&rsquo;s Available</>} className="mb-12 max-w-2xl" />
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
          { src: setting.images[0]?.src ?? null, alt: "A private event at Horseshoe Bay Sporting Club", filename: setting.images[0]?.filename ?? "gallery-1.jpg" },
          { src: setting.images[1]?.src ?? null, alt: "A group on the sporting clays course", filename: setting.images[1]?.filename ?? "gallery-2.jpg" },
          { src: setting.images[2]?.src ?? null, alt: "An evening in the Trophy Room", filename: setting.images[2]?.filename ?? "gallery-3.jpg" },
        ]}
      />

      {/* Inquiry */}
      <Section className="border-t border-property-ink/10 scroll-mt-32" id="inquiry">
        <div className="mx-auto max-w-[800px]">
          <SectionHeading
            eyebrow="Get in Touch"
            heading="Request a Proposal"
            align="center"
            description="Tell us about your group and your date, and our team will follow up to build the day around it."
            className="mb-16"
          />
          {property && <PrivateEventInquiryForm propertyId={property.id} />}
        </div>
      </Section>
    </>
  );
}
