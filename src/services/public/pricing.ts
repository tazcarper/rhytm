import { createServiceRoleClient } from "@/lib/supabase/service";
import type {
  BookingType,
  DisciplineSelection,
} from "@/src/components/public/booking-flow/booking-flow-types";
import type { PublicService } from "./services";

// `pricing_rules` has no public-read RLS policy (staff-only). The public
// booking funnel needs the rule shape to compute the live estimate client-
// side, so this service reads with the service-role key and returns a
// minimal, customer-safe shape — no IDs, no audience_type, just the
// price-affecting fields.
//
// Pre-launch hardening (tagged in TRACKER): promote to a SECURITY DEFINER
// RPC `public_pricing_for_booking(property_id, booking_type)` so we
// don't need service-role for read paths.

export interface TieredRate {
  minGuests: number;
  maxGuests: number;
  ratePerPerson: number;
  // Junior (15 & under) per-person rate. Null when this property/booking
  // type has no age-tiered fee — juniors then pay the adult ratePerPerson.
  juniorRatePerPerson: number | null;
}

export type PricingModel =
  | {
      kind: "flat";
      ratePerUnit: number;
      unit: string;
      perGuestFee: number | null;
      // Junior counterpart to perGuestFee; null → juniors pay perGuestFee.
      juniorPerGuestFee: number | null;
      minimumFee: number | null;
    }
  | { kind: "tiered"; tiers: ReadonlyArray<TieredRate>; minimumFee: number | null }
  | { kind: "team_quoted"; minimumFee: number | null };

type PricingRow = {
  rate_per_unit: string | number | null;
  unit: string | null;
  tiers: unknown;
  minimum_fee: string | number | null;
  per_guest_fee: string | number | null;
  junior_per_guest_fee: string | number | null;
};

type TierRow = {
  min_guests: number;
  max_guests: number;
  rate_per_person: string | number;
  junior_rate_per_person?: string | number | null;
};

export type PricingByBookingType = Partial<Record<BookingType, PricingModel | null>>;

export async function getPublicPricingForProperty(
  propertyId: string,
): Promise<{ data: PricingByBookingType | null; error: { message: string } | null }> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("pricing_rules")
    .select(
      "booking_type, rate_per_unit, unit, tiers, minimum_fee, per_guest_fee, junior_per_guest_fee",
    )
    .eq("property_id", propertyId)
    .eq("audience_type", "public");

  if (error) return { data: null, error: { message: error.message } };

  const map: PricingByBookingType = {};
  for (const row of (data ?? []) as Array<PricingRow & { booking_type: BookingType }>) {
    map[row.booking_type] = rowToPricingModel(row, row.booking_type);
  }
  return { data: map, error: null };
}

function rowToPricingModel(row: PricingRow, bookingType: BookingType): PricingModel {
  const minimumFee = parseNumeric(row.minimum_fee);

  if (bookingType === "host_an_occasion") {
    return { kind: "team_quoted", minimumFee };
  }

  if (row.tiers && Array.isArray(row.tiers) && row.tiers.length > 0) {
    const tiers: TieredRate[] = (row.tiers as TierRow[]).map((t) => ({
      minGuests: t.min_guests,
      maxGuests: t.max_guests,
      ratePerPerson:
        typeof t.rate_per_person === "string"
          ? parseFloat(t.rate_per_person)
          : t.rate_per_person,
      juniorRatePerPerson: parseNumeric(t.junior_rate_per_person),
    }));
    return { kind: "tiered", tiers, minimumFee };
  }

  const ratePerUnit = parseNumeric(row.rate_per_unit);
  if (ratePerUnit !== null && row.unit) {
    return {
      kind: "flat",
      ratePerUnit,
      unit: row.unit,
      perGuestFee: parseNumeric(row.per_guest_fee),
      juniorPerGuestFee: parseNumeric(row.junior_per_guest_fee),
      minimumFee,
    };
  }

  // Rule exists but no usable fields — fall back to team-quoted so the UI
  // surfaces something coherent rather than crashing.
  return { kind: "team_quoted", minimumFee };
}

function parseNumeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? parseFloat(value) : value;
}

// Largest valid guest count for a given booking type + pricing model.
// Tiered rules expose their max explicitly; flat/team-quoted fall back
// to a sane per-type ceiling until Q5/Q2 confirm real bounds.
export function computeMaxGuestCount(
  bookingType: BookingType,
  pricing: PricingModel | null,
): number {
  if (pricing?.kind === "tiered") {
    return Math.max(...pricing.tiers.map((t) => t.maxGuests));
  }
  switch (bookingType) {
    case "private_lesson":
      return 4;
    case "host_an_occasion":
      return 100;
    case "plan_a_visit":
      return 12;
  }
}

// True when this rule carries a distinct junior (15 & under) rate — i.e.
// the funnel should offer a "how many are juniors?" control. Tiered rules
// expose it per tier; flat rules via junior_per_guest_fee. Properties
// without a configured junior rate (HH/Packsaddle placeholders) return
// false and the funnel stays adult-only.
export function hasJuniorPricing(pricing: PricingModel | null): boolean {
  if (!pricing) return false;
  if (pricing.kind === "tiered") {
    return pricing.tiers.some((t) => t.juniorRatePerPerson !== null);
  }
  if (pricing.kind === "flat") {
    return pricing.juniorPerGuestFee !== null;
  }
  return false;
}

// =============================================================
// Full booking summary — view model for the /details right rail
// and the /disciplines estimate bar.
// =============================================================

export interface BookingAddOnLine {
  serviceId: string;
  serviceName: string;
  addOnId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface BookingSummaryData {
  bookingType: BookingType;
  guestCount: number;
  juniorGuestCount: number;
  durationHours: number;
  disciplineNames: ReadonlyArray<string>;
  baseLabel: string;
  baseAmount: number | null;
  // Per-guest fee (flat pricing only — null/zero everywhere else).
  // On the public funnel every attendee is a non-member, so it's
  // computed across every head (the booker pays too), split into adult
  // and junior rates where the rule carries a junior fee.
  guestFeeLabel: string | null;
  guestFeeAmount: number;
  addOns: ReadonlyArray<BookingAddOnLine>;
  addOnTotal: number;
  estimateTotal: number | null;
  isTeamQuoted: boolean;
  minimumApplied: boolean;
}

export interface BuildSummaryArgs {
  bookingType: BookingType;
  pricing: PricingModel | null;
  guestCount: number;
  // How many of guestCount are juniors (15 & under). Adults = the rest.
  juniorGuestCount: number;
  durationHours: number;
  selections: ReadonlyArray<DisciplineSelection>;
  services: ReadonlyArray<PublicService>;
}

export function buildBookingSummary(args: BuildSummaryArgs): BookingSummaryData {
  const {
    bookingType,
    pricing,
    guestCount,
    durationHours,
    selections,
    services,
  } = args;

  // Juniors can't exceed the party size; adults are the remainder.
  const juniorGuestCount = Math.max(0, Math.min(args.juniorGuestCount, guestCount));
  const adultGuestCount = guestCount - juniorGuestCount;

  const servicesById = new Map(services.map((svc) => [svc.id, svc]));
  const disciplineNames = selections
    .map((sel) => servicesById.get(sel.serviceId)?.name)
    .filter((n): n is string => Boolean(n));

  const addOns: BookingAddOnLine[] = [];
  for (const selection of selections) {
    const svc = servicesById.get(selection.serviceId);
    if (!svc) continue;
    const addOnsById = new Map(svc.addOns.map((a) => [a.id, a]));
    for (const sel of selection.addOns) {
      const addOn = addOnsById.get(sel.addOnId);
      if (!addOn) continue;
      addOns.push({
        serviceId: svc.id,
        serviceName: svc.name,
        addOnId: addOn.id,
        name: addOn.name,
        quantity: sel.quantity,
        unitPrice: addOn.price,
        lineTotal: addOn.price * sel.quantity,
      });
    }
  }
  const addOnTotal = addOns.reduce((sum, l) => sum + l.lineTotal, 0);

  const { baseLabel, baseAmount, isTeamQuoted, minimumApplied } = computeBase({
    pricing,
    bookingType,
    adultGuestCount,
    juniorGuestCount,
    durationHours,
  });

  // Per-guest fee — currently only applies to flat pricing (private_lesson).
  // This is the public (non-member) funnel, so the club guest fee applies to
  // every attendee including the booker: a solo non-member lesson is the
  // $200 lesson + one $85 guest fee = $285. (The member path, where dues
  // cover the member's own access, lives elsewhere and is not this rule.)
  // Juniors (15 & under) pay the reduced rate when one is configured.
  // Renders as a separate line so the guest sees the lesson vs. entry split.
  let guestFeeAmount = 0;
  let guestFeeLabel: string | null = null;
  if (
    pricing?.kind === "flat" &&
    pricing.perGuestFee !== null &&
    pricing.perGuestFee > 0 &&
    guestCount > 0
  ) {
    const adultFee = pricing.perGuestFee;
    const juniorFee = pricing.juniorPerGuestFee ?? adultFee;
    guestFeeAmount = adultFee * adultGuestCount + juniorFee * juniorGuestCount;
    guestFeeLabel = formatGuestFeeLabel(
      adultGuestCount,
      adultFee,
      juniorGuestCount,
      juniorFee,
    );
  }

  const estimateTotal = isTeamQuoted
    ? null
    : (baseAmount ?? 0) + guestFeeAmount + addOnTotal;

  return {
    bookingType,
    guestCount,
    juniorGuestCount,
    durationHours,
    disciplineNames,
    baseLabel,
    baseAmount,
    guestFeeLabel,
    guestFeeAmount,
    addOns,
    addOnTotal,
    estimateTotal,
    isTeamQuoted,
    minimumApplied,
  };
}

// "3 adults × $85 + 2 juniors × $55" — drops a side when its count is 0,
// and stays singular/plural correct. Used for both the flat guest-fee
// line and the tiered base line so they read consistently.
function formatGuestFeeLabel(
  adults: number,
  adultRate: number,
  juniors: number,
  juniorRate: number,
): string {
  const parts: string[] = [];
  if (adults > 0) {
    parts.push(`${adults} ${adults === 1 ? "adult" : "adults"} × $${adultRate.toFixed(0)}`);
  }
  if (juniors > 0) {
    parts.push(`${juniors} ${juniors === 1 ? "junior" : "juniors"} × $${juniorRate.toFixed(0)}`);
  }
  return parts.join(" + ");
}

interface BaseResult {
  baseLabel: string;
  baseAmount: number | null;
  isTeamQuoted: boolean;
  minimumApplied: boolean;
}

function computeBase(args: {
  pricing: PricingModel | null;
  bookingType: BookingType;
  adultGuestCount: number;
  juniorGuestCount: number;
  durationHours: number;
}): BaseResult {
  const { pricing, bookingType, adultGuestCount, juniorGuestCount, durationHours } = args;
  const guestCount = adultGuestCount + juniorGuestCount;

  if (!pricing) {
    return {
      baseLabel: bookingTypeLabel(bookingType),
      baseAmount: null,
      isTeamQuoted: true,
      minimumApplied: false,
    };
  }

  if (pricing.kind === "team_quoted") {
    return {
      baseLabel: `${bookingTypeLabel(bookingType)} — team-quoted`,
      baseAmount: null,
      isTeamQuoted: true,
      minimumApplied: false,
    };
  }

  if (pricing.kind === "flat") {
    let amount = pricing.ratePerUnit * durationHours;
    let minimumApplied = false;
    if (pricing.minimumFee !== null && amount < pricing.minimumFee) {
      amount = pricing.minimumFee;
      minimumApplied = true;
    }
    return {
      baseLabel: `${bookingTypeLabel(bookingType)} — ${durationHours} ${pricing.unit}${durationHours === 1 ? "" : "s"} × $${pricing.ratePerUnit.toFixed(0)}`,
      baseAmount: amount,
      isTeamQuoted: false,
      minimumApplied,
    };
  }

  // tiered — pick the tier by total party size, then price adults and
  // juniors separately (juniors fall back to the adult rate when the tier
  // carries no junior rate).
  const tier =
    pricing.tiers.find(
      (t) => guestCount >= t.minGuests && guestCount <= t.maxGuests,
    ) ?? pricing.tiers[pricing.tiers.length - 1];
  const adultRate = tier?.ratePerPerson ?? 0;
  const juniorRate = tier?.juniorRatePerPerson ?? adultRate;
  let amount = adultRate * adultGuestCount + juniorRate * juniorGuestCount;
  let minimumApplied = false;
  if (pricing.minimumFee !== null && amount < pricing.minimumFee) {
    amount = pricing.minimumFee;
    minimumApplied = true;
  }
  const countsLabel =
    juniorGuestCount > 0
      ? formatGuestFeeLabel(adultGuestCount, adultRate, juniorGuestCount, juniorRate)
      : `${guestCount} ${guestCount === 1 ? "guest" : "guests"} × $${adultRate.toFixed(0)}`;
  return {
    baseLabel: `${bookingTypeLabel(bookingType)} — ${countsLabel}`,
    baseAmount: amount,
    isTeamQuoted: false,
    minimumApplied,
  };
}

function bookingTypeLabel(t: BookingType): string {
  switch (t) {
    case "plan_a_visit":
      return "Plan a Visit";
    case "private_lesson":
      return "Private Lesson";
    case "host_an_occasion":
      return "Host an Occasion";
  }
}
