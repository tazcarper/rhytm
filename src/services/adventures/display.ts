import type { BadgeVariant } from "@/lib/ui/primitives/badge/badge";
import { formatDateRange, formatMoney } from "@/src/services/public/format";

// Shared adventure presentation logic — one source of truth for the
// member portal (/member/adventures) and the public surfaces (homepage
// showcase + /adventures/[id] detail). The DB columns are the truth;
// `details` jsonb carries optional display overrides + images. These
// helpers prefer an override when present, else derive from real data.

export type AdventureStatus =
  | "draft"
  | "published"
  | "sold_out"
  | "cancelled"
  | "completed";

// One editorial "chapter" on the detail page (Matador-style: heading +
// narrative + a large image, alternating sides).
export interface AdventureSection {
  heading: string;
  body: string;
  image?: string;
}

// Display fields member_adventures has no column for — stored in the
// `details` jsonb. All optional.
export interface AdventureDetails {
  category?: string; // eyebrow, e.g. "Wingshooting"
  location?: string; // destination, e.g. "Córdoba, Argentina" (NOT the owning property)
  durationLabel?: string; // "5 nights / 4 hunting days"
  datesLabel?: string; // overrides the computed start–end range
  priceLabel?: string; // overrides the computed price ("Included", "—")
  capacityLabel?: string; // overrides the (member-invisible) remaining count
  badge?: string; // overrides the derived status badge text
  comingSoon?: boolean; // not yet bookable; disables reserve, shows "Coming soon"
  heroImage?: string; // detail-page hero + card image URL
  gallery?: string[]; // detail-page gallery image URLs
  attributes?: string[]; // "type of stay" icon keys — see ADVENTURE_ATTRIBUTES
  highlights?: string[]; // short at-a-glance bullets
  sections?: AdventureSection[]; // long-form editorial chapters
}

// Tolerant parser. The column is jsonb with no DB-level schema, so accept
// only fields of the expected shape and drop anything else. Never throws.
export function parseAdventureDetails(raw: unknown): AdventureDetails {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof obj[key] === "string" && obj[key] !== "" ? (obj[key] as string) : undefined;
  const strArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const items = value.filter((v): v is string => typeof v === "string" && v !== "");
    return items.length > 0 ? items : undefined;
  };
  const sections = Array.isArray(obj.sections)
    ? obj.sections.flatMap((entry): AdventureSection[] => {
        if (!entry || typeof entry !== "object") return [];
        const sectionObj = entry as Record<string, unknown>;
        const heading = typeof sectionObj.heading === "string" ? sectionObj.heading : null;
        const body = typeof sectionObj.body === "string" ? sectionObj.body : null;
        if (!heading || !body) return [];
        return [
          {
            heading,
            body,
            image: typeof sectionObj.image === "string" ? sectionObj.image : undefined,
          },
        ];
      })
    : undefined;
  return {
    category: str("category"),
    location: str("location"),
    durationLabel: str("durationLabel"),
    datesLabel: str("datesLabel"),
    priceLabel: str("priceLabel"),
    capacityLabel: str("capacityLabel"),
    badge: str("badge"),
    comingSoon: obj.comingSoon === true,
    heroImage: str("heroImage"),
    gallery: strArray(obj.gallery),
    attributes: strArray(obj.attributes),
    highlights: strArray(obj.highlights),
    sections: sections && sections.length > 0 ? sections : undefined,
  };
}

export interface AdventureBadge {
  text: string;
  variant: BadgeVariant;
}

// Status badge text + variant. Order matters: coming-soon wins, then
// sold-out, then a "Filling Fast" override, then the default open state.
export function adventureBadge(a: {
  isSoldOut: boolean;
  comingSoon: boolean;
  badge: string | null;
}): AdventureBadge {
  if (a.comingSoon) return { text: a.badge ?? "Coming Soon", variant: "draft" };
  if (a.isSoldOut) return { text: a.badge ?? "Waitlist Only", variant: "waitlist" };
  if ((a.badge ?? "").toLowerCase().includes("filling")) {
    return { text: a.badge as string, variant: "filling" };
  }
  return { text: a.badge ?? "Now Booking", variant: "open" };
}

export function adventurePriceLabel(a: {
  price: number;
  guestPrice: number | null;
  priceLabel: string | null;
}): string {
  if (a.priceLabel) return a.priceLabel;
  const base = a.price === 0 ? "Included" : `$${formatMoney(a.price)}`;
  if (a.price > 0 && a.guestPrice && a.guestPrice > 0) {
    return `${base} · $${formatMoney(a.guestPrice)} / additional guest`;
  }
  return base;
}

export function adventureDateLabel(a: {
  startDate: string;
  endDate: string;
  datesLabel: string | null;
}): string {
  return a.datesLabel ?? formatDateRange(a.startDate, a.endDate);
}

// Trip total for a party. guest_count includes the member, so each guest
// BEYOND the first adds guest_price. Mirrors the DB pricing semantics
// (Phase 5: price + (guest_count - 1) * COALESCE(guest_price, 0)).
export function adventureTotal(
  price: number,
  guestPrice: number | null,
  guestCount: number,
): number {
  const extra = Math.max(0, guestCount - 1);
  return price + extra * (guestPrice ?? 0);
}

export function adventureTotalLabel(
  price: number,
  guestPrice: number | null,
  guestCount: number,
): string {
  const total = adventureTotal(price, guestPrice, guestCount);
  return total === 0 ? "Included" : `$${formatMoney(total)}`;
}

// Flatten markdown to plain text for tight contexts (image-overlay tile
// blurbs) where the description's bold/links/bullets would render as raw
// syntax. The detail page renders the full markdown via MarkdownProse.
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/[*_~`#>]/g, "") // emphasis / heading / quote / code marks
    .replace(/^\s*[-+*]\s+/gm, "") // list bullets
    .replace(/\s+/g, " ")
    .trim();
}
