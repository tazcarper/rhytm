// Per-property identity/navigation/contact content for the new marketing
// template. Keyed by the same slugs already used across the app
// (property-copy.ts, properties.slug, /request-estimate/[club], etc.).
// horseshoe-bay and hog-heaven are populated — packsaddle slots in here
// later without any component changes, since PropertyHeader/PropertyFooter
// read everything from this config.

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
  /** Footer's logo slot — mockups use a distinct vertical/on-dark mark
      here, not the header's horizontal one (the footer band is dark).
      Every property sets this explicitly, even when it's just reusing
      logoSrc as a placeholder until a real dark-mode mark is handed off —
      no `?? logoSrc` fallback at the render site. */
  footerLogoSrc: string;
  addressLines: string[];
  email: string;
  phone: string;
  phoneHref: string;
  officeHours: { label: string; hours: string }[];
  navLinks: PropertyNavLink[];
  socialLinks: PropertySocialLink[];
  siblingProperties: PropertySiblingLink[];
  newsletterHeading: string;
  newsletterBlurb: string;
}

export const PROPERTY_PROFILES: Record<string, PropertyProfile> = {
  "horseshoe-bay": {
    slug: "horseshoe-bay",
    name: "Horseshoe Bay Sporting Club",
    shortName: "Horseshoe Bay",
    assetBase: "/properties/horseshoe-bay",
    logoSrc: "/properties/horseshoe-bay/horseshoebay_logo_primary-horizontal_fullcolor_on-light.svg",
    // The mockup references a vertical/on-dark mark for the footer
    // (horseshoebay_logo_primary_vertical_fullcolor_on-dark.png) but the
    // file was never actually handed off into assets/ — reusing the
    // horizontal mark here until the real one arrives.
    footerLogoSrc: "/properties/horseshoe-bay/horseshoebay_logo_primary-horizontal_fullcolor_on-light.svg",
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
    newsletterHeading: "Newsletter",
    newsletterBlurb: "Receive regular updates and club news.",
  },
  "hog-heaven": {
    slug: "hog-heaven",
    name: "Hog Heaven Sporting Club",
    shortName: "Hog Heaven",
    assetBase: "/properties/hog-heaven",
    logoSrc: "/properties/hog-heaven/hogheaven_logo_primary_horizontal_on-light.png",
    footerLogoSrc: "/properties/hog-heaven/hogheaven_logo_primary_vertical_on-dark.png",
    addressLines: ["24905 Ranch Rd 12", "Dripping Springs, TX 78620"],
    email: "shoot@hogheavensportingclub.com",
    phone: "(512) 987-6938",
    phoneHref: "+15129876938",
    officeHours: [
      { label: "Mon", hours: "Closed" },
      { label: "Tue–Sat", hours: "10 AM – 4 PM" },
      { label: "Sun", hours: "Closed" },
    ],
    navLinks: [
      { label: "Club Life", href: "/hog-heaven/club-life" },
      { label: "Adventure", href: "/hog-heaven/adventures" },
      { label: "Education", href: "/hog-heaven/education" },
      { label: "Membership", href: "/hog-heaven/membership" },
      { label: "Events Calendar", href: "/hog-heaven/events" },
      { label: "Private Events", href: "/hog-heaven/private-events" },
    ],
    socialLinks: [
      { label: "Instagram", href: "https://www.instagram.com/hogheavensporting/" },
      { label: "Facebook", href: "https://www.facebook.com/hogheavensporting/" },
    ],
    siblingProperties: [
      { name: "Hog Heaven Sporting Club", href: "/hog-heaven" },
      { name: "Horseshoe Bay Sporting Club", href: "/horseshoe-bay" },
      { name: "Packsaddle Precision", href: "/packsaddle" },
    ],
    newsletterHeading: "Newsletter",
    newsletterBlurb: "Receive regular updates and club news.",
  },
  "packsaddle": {
    slug: "packsaddle",
    name: "Packsaddle Precision",
    shortName: "Packsaddle",
    assetBase: "/properties/packsaddle",
    logoSrc: "/properties/packsaddle/packsaddle_logo_primary_horizontal_on-light.svg",
    footerLogoSrc: "/properties/packsaddle/packsaddle_logo_primary_vertical_fullcolor.png",
    // The mockup's own footer still has these as literal bracket
    // placeholders ("[Street Address]", "Kingsland, TX [ZIP]", "[email
    // address]", "[phone number]") — carried through here honestly rather
    // than inventing values that would look real. Replace once the
    // client/developer hands off actual contact info.
    addressLines: ["[Street Address]", "Kingsland, TX [ZIP]"],
    email: "[email address]",
    phone: "[phone number]",
    phoneHref: "",
    officeHours: [
      { label: "Mon", hours: "Closed" },
      { label: "Tue–Sat", hours: "10 AM – 4 PM" },
      { label: "Sun", hours: "Closed" },
    ],
    navLinks: [
      { label: "Club Life", href: "/packsaddle/club-life" },
      { label: "Adventure", href: "/packsaddle/adventures" },
      { label: "Education", href: "/packsaddle/education" },
      { label: "Membership", href: "/packsaddle/membership" },
      { label: "Events Calendar", href: "/packsaddle/events" },
      // Deliberately no Private Events link — the mockup's own header
      // comment flags that page as "hidden, not launching with it" for
      // Packsaddle, unlike the other two properties. See
      // plan/frontend/packsaddle-remaining-pages.md.
    ],
    socialLinks: [
      { label: "Instagram", href: "https://instagram.com/packsaddleprecision" },
      // Facebook is still a "#" placeholder href in the mockup footer —
      // no real handle exists yet, so it's omitted rather than linking
      // nowhere.
    ],
    siblingProperties: [
      { name: "Hog Heaven Sporting Club", href: "/hog-heaven" },
      { name: "Horseshoe Bay Sporting Club", href: "/horseshoe-bay" },
      { name: "Packsaddle Precision", href: "/packsaddle" },
    ],
    newsletterHeading: "Newsletter",
    newsletterBlurb: "Receive regular updates and club news.",
  },
};

export function getPropertyProfile(slug: string): PropertyProfile | null {
  return PROPERTY_PROFILES[slug] ?? null;
}
