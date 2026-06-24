import { computeBookingAdvisories } from "@/src/services/public/booking-advisories";
import type {
  EstimateCatalog,
  EstimateExperience,
  EstimateGuestFeeTier,
} from "@/src/services/public/estimate-catalog";

// Estimate domain types, defined in the service layer so the pure pricing
// module owns no component dependency. The component (rules.ts) re-exports
// these for its own use — the dependency points component → service.

// The host of record. A member host may bring non-member guests; a non-member
// host books direct (and is blocked at HSB).
export type HostCode = "member" | "nonmember";

// A staff-added flat line on the bid (Musical Guest, Snake Trainer, …).
export interface CustomLine {
  label: string;
  amount: number;
}

// The whole indicative estimate computation — a pure, DB-driven port of the
// retired rules.ts computeEstimate(). It takes the property's catalog (from
// getEstimateCatalog) plus the user's selections and returns the line
// breakdown + headline. No DB access, no React: unit-testable, and shared
// verbatim by the form (live preview) and the submit action (carried bid
// lines) so the two can never disagree.
//
// Money never moves on this number — the binding price is staff-built on the
// bid. This drives the live preview and the stored indicative_total string.
//
// TODO(tests): this module is pure and the prime candidate for unit tests —
// add golden-number cases once a test runner (e.g. vitest) is configured:
// guest-fee tiers (adult+junior banding), lesson ladder cohort wrap
// (i % cohort), class member/public split, add-on member discount, catering
// per-head, the members-only non-member safeguard, and the quote→"Custom"
// headline. Verified by hand against the retired rules.ts for now.

// Member retail discount, applied to add-ons flagged memberDiscount when the
// host is a member.
export const MEMBER_RETAIL_DISCOUNT = 0.2;
// Standard private-lesson block when the user hasn't picked a length.
export const STANDARD_BLOCK_HOURS = 2;

export interface EstimateSelections {
  host: HostCode;
  // Selected experience (service) ids.
  experienceIds: ReadonlyArray<string>;
  // Private-lesson length in hours (2-hr standard block).
  lessonHours: number;
  // Party composition. members shoot on dues (member host only); guests drive fees.
  members: number;
  guestAdults: number;
  guestJuniors: number;
  // Add-on id → chosen quantity (0/1 for a Yes/No add-on).
  addOnQuantities: Record<string, number>;
  cateringId: string | null;
  // Staff phone-intake extras.
  staffMode: boolean;
  discountValue: number;
  discountType: "pct" | "amt";
  customLines: ReadonlyArray<CustomLine>;
  // Advisory inputs (heat / escalation / private-event flag).
  arrival: string;
  date: string;
}

// Club-identity gating, computed by the caller from rules.ts (isComingSoon /
// isHsbBlocked) — kept out of the pricing math so this module stays catalog-
// driven and unit-testable.
export interface EstimateGating {
  comingSoon: boolean;
  membersOnlyBlocked: boolean;
}

export interface EstimateLine {
  label: string;
  amount: number;
  exempt?: boolean;
  tbd?: boolean;
  negative?: boolean;
}

export interface EstimateResult {
  lines: EstimateLine[];
  total: number;
  // Headline as displayed ("$1,240", "Coming Soon", "Members only", "Custom").
  grandLabel: string;
  escalation: string;
  ctaLabel: string;
  heat: boolean;
  comingSoon: boolean;
  hsbBlocked: boolean;
  isEvent: boolean;
}

export function money(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

// First band whose ceiling covers the guest count; the top band catches
// anything larger (mirrors the retired guestRate()).
function guestFeeTierFor(
  tiers: ReadonlyArray<EstimateGuestFeeTier>,
  guests: number,
): EstimateGuestFeeTier | null {
  if (tiers.length === 0) return null;
  return tiers.find((b) => guests <= b.maxGuests) ?? tiers[tiers.length - 1];
}

export function computeEstimate(
  catalog: EstimateCatalog,
  selections: EstimateSelections,
  gating: EstimateGating,
): EstimateResult {
  const memberHost = selections.host === "member";
  const members = memberHost ? Math.max(0, selections.members || 0) : 0;
  const gAdults = Math.max(0, selections.guestAdults || 0);
  const gJrs = Math.max(0, selections.guestJuniors || 0);
  const guests = gAdults + gJrs; // non-member guests
  const totalHead = members + guests;
  const isMember = memberHost;

  if (gating.comingSoon) {
    return {
      lines: [],
      total: 0,
      grandLabel: "Coming Soon",
      escalation: "",
      ctaLabel: "Notify me when it opens →",
      heat: false,
      comingSoon: true,
      hsbBlocked: false,
      isEvent: false,
    };
  }
  if (gating.membersOnlyBlocked) {
    return {
      lines: [],
      total: 0,
      grandLabel: "Members only",
      escalation: "",
      ctaLabel: "Inquire about membership →",
      heat: false,
      comingSoon: false,
      hsbBlocked: true,
      isEvent: false,
    };
  }

  const lines: EstimateLine[] = [];
  let total = 0;

  const byId = new Map(catalog.experiences.map((e) => [e.id, e]));
  const selected = selections.experienceIds
    .map((id) => byId.get(id))
    .filter((e): e is EstimateExperience => Boolean(e))
    // Safeguard: a members-only experience is never priced for a non-member
    // host (the form also blocks selecting it). Self-protecting so a stale or
    // tampered selection can't sneak a members-only experience into the quote.
    .filter((e) => !(e.membersOnly && selections.host === "nonmember"));

  // Guest fees apply to any guest-fee-tier or lesson experience (a lesson still
  // carries the club entry fee on top of its ladder); class & quote do not.
  const usesGuestFee = selected.some(
    (e) => e.pricingKind === "guest_fee_tier" || e.pricingKind === "lesson_ladder",
  );

  // Guest fees on GUESTS only (members excluded), tiered by guest count.
  if (usesGuestFee && guests > 0) {
    const tier = guestFeeTierFor(catalog.guestFeeTiers, guests);
    if (tier) {
      if (gAdults) {
        lines.push({
          label: `Guest fee · ${gAdults} guest adult @ ${money(tier.adult)}`,
          amount: gAdults * tier.adult,
        });
        total += gAdults * tier.adult;
      }
      if (gJrs) {
        lines.push({
          label: `Junior guest fee · ${gJrs} @ ${money(tier.junior)}`,
          amount: gJrs * tier.junior,
        });
        total += gJrs * tier.junior;
      }
    }
  }

  // Private lesson — flat hourly ladder × hours (2-hr standard), all
  // participants (members + guests). Cohort of `lessonCohortSize`: the
  // (cohort+1)th student reopens at the lead-slot rate (i % cohort).
  for (const exp of selected.filter((e) => e.pricingKind === "lesson_ladder")) {
    const ladder = exp.lessonLadder ?? [];
    if (ladder.length === 0) continue;
    const cohort = exp.lessonCohortSize > 0 ? exp.lessonCohortSize : ladder.length;
    const hrs = selections.lessonHours || STANDARD_BLOCK_HOURS;
    const students = Math.max(1, totalHead);
    let perHr = 0;
    for (let i = 0; i < students; i++) {
      perHr += ladder[i % cohort] ?? ladder[ladder.length - 1];
    }
    const cost = perHr * hrs;
    lines.push({
      label: `${exp.name} · ${students} student${students > 1 ? "s" : ""} × ${hrs} hr`,
      amount: cost,
      exempt: true,
    });
    total += cost;
  }

  // Class / clinic — members at member rate, guests at public rate.
  for (const exp of selected.filter((e) => e.pricingKind === "class_per_person")) {
    const memberRate = exp.classPriceMember ?? 0;
    const publicRate = exp.classPricePublic ?? 0;
    if (members) {
      const cost = members * memberRate;
      lines.push({
        label: `${exp.name} · ${members} member${members > 1 ? "s" : ""} × ${memberRate ? money(memberRate) : "free"}`,
        amount: cost,
      });
      total += cost;
    }
    if (gAdults) {
      const cost = gAdults * publicRate;
      lines.push({
        label: `${exp.name} · ${gAdults} guest${gAdults > 1 ? "s" : ""} × ${money(publicRate)}`,
        amount: cost,
      });
      total += cost;
    }
  }

  // Quote experiences (event / facility) — "we'll quote this", no number.
  const quoteExps = selected.filter((e) => e.pricingKind === "quote");
  for (const exp of quoteExps) {
    lines.push({ label: `${exp.name} · we'll quote this`, amount: 0, tbd: true });
  }

  // Add-ons — quantity × price, with the optional member discount on flagged
  // items. Every active add-on is priceable; a Yes/No add-on is quantity 0/1.
  const memberFactor = 1 - MEMBER_RETAIL_DISCOUNT;
  for (const addOn of catalog.addOns) {
    const quantity = Math.max(0, selections.addOnQuantities[addOn.id] ?? 0);
    if (quantity <= 0) continue;
    const applyDiscount = isMember && addOn.memberDiscount;
    const cost = quantity * addOn.price * (applyDiscount ? memberFactor : 1);
    const mbr = applyDiscount ? " (mbr)" : "";
    const label =
      addOn.control === "bool"
        ? `${addOn.name}${mbr}`
        : `${addOn.name} · ${quantity}${mbr}`;
    lines.push({ label, amount: cost });
    total += cost;
  }

  // F&B catering — per-head × total headcount (everyone eats).
  if (selections.cateringId) {
    const option = catalog.catering.find((c) => c.id === selections.cateringId);
    if (option) {
      const cost = option.pricePerHead * totalHead;
      lines.push({
        label: `Catering · ${option.vendorName} · ${totalHead} @ $${option.pricePerHead}/head`,
        amount: cost,
      });
      total += cost;
    }
  }

  // Staff manual line items (staff mode only).
  if (selections.staffMode) {
    for (const line of selections.customLines) {
      lines.push({ label: `${line.label} · custom`, amount: line.amount });
      total += line.amount;
    }
  }

  // Staff discount.
  if (selections.staffMode && selections.discountValue > 0) {
    const cut =
      selections.discountType === "pct"
        ? total * (selections.discountValue / 100)
        : selections.discountValue;
    total = Math.max(0, total - cut);
    lines.push({
      label: `Staff discount (${selections.discountType === "pct" ? selections.discountValue + "%" : money(selections.discountValue)})`,
      amount: -cut,
      negative: true,
    });
  }

  // Non-pricing advisories — guests drive ratios (members excluded), totalHead
  // drives the private-event reservation flag.
  const advisories = computeBookingAdvisories({
    guests,
    totalHead,
    arrival: selections.arrival,
    date: selections.date,
  });

  const hasQuote = quoteExps.length > 0;
  const grandLabel = hasQuote && total === 0 ? "Custom" : money(total);

  return {
    lines,
    total,
    grandLabel,
    escalation: advisories.escalationLabel,
    ctaLabel: selections.staffMode
      ? "Create request (on behalf) →"
      : "Request my estimate →",
    heat: advisories.heatWarning,
    comingSoon: false,
    hsbBlocked: false,
    isEvent: advisories.isPrivateEvent,
  };
}
