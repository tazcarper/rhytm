// Per-property identity/navigation/contact content for the new marketing
// template. Keyed by the same slugs already used across the app
// (property-copy.ts, properties.slug, /request-estimate/[club], etc.).
// Only horseshoe-bay is populated for the pilot — hog-heaven and
// packsaddle slot in here later without any component changes, since
// PropertyHeader/PropertyFooter read everything from this config.

export interface PropertyNavLink {
  label: string;
  href: string;
}

export interface PropertySocialLink {
  label: string;
  href: string;
}

export interface PropertySiblingLink {
  name: string;
  href: string;
}

export interface PropertyProfile {
  slug: string;
  name: string;
  shortName: string;
  assetBase: string; // /properties/<slug>
  logoSrc: string;
  addressLines: string[];
  email: string;
  phone: string;
  phoneHref: string;
  officeHours: { label: string; hours: string }[];
  navLinks: PropertyNavLink[];
  socialLinks: PropertySocialLink[];
  siblingProperties: PropertySiblingLink[];
}

export const PROPERTY_PROFILES: Record<string, PropertyProfile> = {
  "horseshoe-bay": {
    slug: "horseshoe-bay",
    name: "Horseshoe Bay Sporting Club",
    shortName: "Horseshoe Bay",
    assetBase: "/properties/horseshoe-bay",
    logoSrc: "/properties/horseshoe-bay/horseshoebay_logo_primary-horizontal_fullcolor_on-light.svg",
    addressLines: ["23753 State Hwy 71", "Horseshoe Bay, TX 78657"],
    email: "info@hsbsportingclub.com",
    phone: "(830) 825-1550",
    phoneHref: "+18308251550",
    officeHours: [
      { label: "Mon", hours: "Closed" },
      { label: "Tue–Sat", hours: "9 AM – 5 PM" },
      { label: "Sun", hours: "10 AM – 5 PM" },
    ],
    navLinks: [
      { label: "Club Life", href: "/horseshoe-bay/club-life" },
      { label: "Adventure", href: "/horseshoe-bay/adventures" },
      { label: "Education", href: "/horseshoe-bay/education" },
      { label: "Membership", href: "/horseshoe-bay/membership" },
      { label: "Events Calendar", href: "/horseshoe-bay/events" },
      { label: "Private Events", href: "/horseshoe-bay/private-events" },
    ],
    socialLinks: [
      { label: "Instagram", href: "https://www.instagram.com/hsbsportingclub/" },
      { label: "Facebook", href: "https://www.facebook.com/HSBSportingClub/" },
    ],
    siblingProperties: [
      { name: "Hog Heaven Sporting Club", href: "/hog-heaven" },
      { name: "Horseshoe Bay Sporting Club", href: "/horseshoe-bay" },
      { name: "Packsaddle Precision", href: "/packsaddle" },
    ],
  },
};

export function getPropertyProfile(slug: string): PropertyProfile | null {
  return PROPERTY_PROFILES[slug] ?? null;
}
