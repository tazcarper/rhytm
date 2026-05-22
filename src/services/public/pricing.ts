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
}

export type PricingModel =
  | {
      kind: "flat";
      ratePerUnit: number;
      unit: string;
      perGuestFee: number | null;
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
};

type TierRow = {
  min_guests: number;
  max_guests: number;
  rate_per_person: string | number;
};

export type PricingByBookingType = Partial<Record<BookingType, PricingModel | null>>;

export async function getPublicPricingForProperty(
  propertyId: string,
): Promise<{ data: PricingByBookingType | null; error: { message: string } | null }> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("pricing_rules")
    .select(
      "booking_type, rate_per_unit, unit, tiers, minimum_fee, per_guest_fee",
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
  durationHours: number;
  disciplineNames: ReadonlyArray<string>;
  baseLabel: string;
  baseAmount: number | null;
  // Per-guest fee (flat pricing only — null/zero everywhere else).
  // Computed as `perGuestFee × max(0, guestCount - 1)`.
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
    guestCount,
    durationHours,
  });

  // Per-guest fee — currently only applies to flat pricing (private_lesson).
  // Renders as a separate line in the summary so the guest sees what they're
  // paying for (base experience vs. extra heads).
  let guestFeeAmount = 0;
  let guestFeeLabel: string | null = null;
  if (
    pricing?.kind === "flat" &&
    pricing.perGuestFee !== null &&
    pricing.perGuestFee > 0 &&
    guestCount > 1
  ) {
    const extras = guestCount - 1;
    guestFeeAmount = pricing.perGuestFee * extras;
    guestFeeLabel = `${extras} extra ${extras === 1 ? "guest" : "guests"} × $${pricing.perGuestFee.toFixed(0)}`;
  }

  const estimateTotal = isTeamQuoted
    ? null
    : (baseAmount ?? 0) + guestFeeAmount + addOnTotal;

  return {
    bookingType,
    guestCount,
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

interface BaseResult {
  baseLabel: string;
  baseAmount: number | null;
  isTeamQuoted: boolean;
  minimumApplied: boolean;
}

function computeBase(args: {
  pricing: PricingModel | null;
  bookingType: BookingType;
  guestCount: number;
  durationHours: number;
}): BaseResult {
  const { pricing, bookingType, guestCount, durationHours } = args;

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

  // tiered
  const tier =
    pricing.tiers.find(
      (t) => guestCount >= t.minGuests && guestCount <= t.maxGuests,
    ) ?? pricing.tiers[pricing.tiers.length - 1];
  const rate = tier?.ratePerPerson ?? 0;
  let amount = rate * guestCount;
  let minimumApplied = false;
  if (pricing.minimumFee !== null && amount < pricing.minimumFee) {
    amount = pricing.minimumFee;
    minimumApplied = true;
  }
  return {
    baseLabel: `${bookingTypeLabel(bookingType)} — ${guestCount} ${guestCount === 1 ? "guest" : "guests"} × $${rate.toFixed(0)}`,
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
