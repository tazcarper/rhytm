// ===== ENCODED RULES — the executable spec =====
// Ported verbatim from Rhythm_Event_Intake_Prototype.html. This is the
// source of truth for the indicative estimate math: guest-fee ladders per
// club, the 1:5 RSO + instructor escalation, the private-lesson ladder,
// ammo-as-quantity, member 20% on retail goods, HH/Packsaddle catering
// tiers, the HSB members-only block, and Packsaddle "Coming Soon".
//
// INDICATIVE ONLY. The binding price is staff-built on the bid — this math
// drives the live preview and the stored `indicative_total` display string,
// nothing that moves money. Expect the numbers/copy to change (Ryan/Stitch
// later); the logic lives here, isolated, so that swap stays cheap.

export type ClubCode = "hsb" | "hh" | "psp";
export type WhoCode = "member" | "nonmember";

// Club selection ↔ the seeded `properties.slug` values.
export const CLUB_TO_SLUG: Record<ClubCode, string> = {
  hsb: "horseshoe-bay",
  hh: "hog-heaven",
  psp: "packsaddle",
};

export const CLUB_LABELS: Record<ClubCode, string> = {
  hsb: "Horseshoe Bay SC",
  hh: "Hog Heaven SC",
  psp: "Packsaddle Precision",
};

interface FeeBand {
  max: number;
  a: number;
  j: number;
}

export interface ExperienceDef {
  id: string;
  t: string;
  d: string;
  lesson: boolean;
  membersOnly?: boolean;
  custom?: boolean;
}

export interface AddonDef {
  id: "ammo" | "gear" | "cart";
  nm: string;
  shape: "qty" | "perperson" | "bool";
  unit?: string;
  meta: string;
}

export interface CateringOption {
  tier: string;
  name: string;
  per: number;
}

export const RULES = {
  guestFee: {
    hsb: [
      { max: 4, a: 85, j: 55 },
      { max: 9, a: 110, j: 80 },
      { max: 14, a: 130, j: 100 },
      { max: 19, a: 150, j: 120 },
      { max: 24, a: 160, j: 130 },
    ] as FeeBand[],
    hh: [
      { max: 4, a: 50, j: 35 },
      { max: 9, a: 75, j: 55 },
      { max: 14, a: 95, j: 70 },
      { max: 19, a: 115, j: 85 },
      { max: 24, a: 125, j: 95 },
    ] as FeeBand[],
    psp: null,
  },
  rsoPerGuests: 5,
  seniorInstructorAt: 15,
  secondInstructorAt: 20,
  lessonLadder: [200, 100, 50, 50, 50],
  ammoBox: 17,
  gearPerPerson: 40,
  drinkCart: 75,
  memberRetailDiscount: 0.2,
  experiences: {
    hsb: [
      { id: "clays", t: "Sporting Clays", d: "Cart + clays bundled", lesson: false },
      { id: "pistol", t: "Pistol / Carbine Bay", d: "Bay session", lesson: false },
      { id: "lesson", t: "Private Lesson", d: "Instructor ladder pricing", lesson: true },
      { id: "event", t: "Tournament / Event", d: "Registered event", lesson: false, membersOnly: true },
    ] as ExperienceDef[],
    hh: [
      { id: "clays", t: "Sporting Clays", d: "Cart + clays bundled", lesson: false },
      { id: "pistol", t: "Pistol Bay", d: "Bay session", lesson: false },
      { id: "lesson", t: "Private Lesson", d: "Instructor ladder pricing", lesson: true },
      { id: "event", t: "Event / Clinic", d: "Registered event", lesson: false },
      { id: "facility", t: "General Facility Usage", d: "Wedding · bridal · event space", lesson: false, custom: true },
    ] as ExperienceDef[],
    psp: [] as ExperienceDef[],
  },
  comingSoon: { psp: true } as Partial<Record<ClubCode, boolean>>,
  addons: [
    { id: "ammo", nm: "Ammunition", shape: "qty", unit: "box", meta: "~1 box / 25 targets · retail $17" },
    { id: "gear", nm: "Firearm / gear rental", shape: "perperson", meta: "per shooter · retail $40" },
    { id: "cart", nm: "Extra drink cart", shape: "bool", meta: "yes / no" },
  ] as AddonDef[],
  // F&B catering — HH + Packsaddle ONLY. (HSB dining runs through The Club.)
  catering: {
    hh: [
      { tier: "Good", name: "County Line BBQ", per: 24 },
      { tier: "Better", name: "The Salt Lick BBQ", per: 34 },
      { tier: "Best", name: "Contigo · Hill Country", per: 58 },
    ] as CateringOption[],
    psp: [
      { tier: "Good", name: "County Line BBQ", per: 24 },
      { tier: "Better", name: "The Salt Lick BBQ", per: 34 },
      { tier: "Best", name: "Contigo · Hill Country", per: 58 },
    ] as CateringOption[],
  } as Partial<Record<ClubCode, CateringOption[]>>,
} as const;

export interface AddonState {
  ammo: number;
  gear: number;
  cart: boolean;
}

export interface IntakeState {
  who: WhoCode;
  club: ClubCode;
  exps: string[];
  addons: AddonState;
  catering: CateringOption | null;
  adults: number;
  juniors: number;
  // Staff-only discount.
  staffMode: boolean;
  discountValue: number;
  discountType: "pct" | "amt";
  // Timing.
  arrival: string;
  date: string;
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
  // The headline figure as displayed (e.g. "$1,240", "Coming Soon",
  // "Members only", "Custom"). Stored verbatim as indicative_total.
  grandLabel: string;
  escalation: string;
  ctaLabel: string;
  heat: boolean;
  comingSoon: boolean;
  hsbBlocked: boolean;
}

export function money(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

function band(club: ClubCode, n: number): FeeBand | null {
  const t = RULES.guestFee[club];
  if (!t) return null;
  return t.find((b) => n <= b.max) ?? t[t.length - 1];
}

// True when this club currently shows the "Coming Soon" gate.
export function isComingSoon(club: ClubCode): boolean {
  return !!RULES.comingSoon[club];
}

// True when a non-member is blocked from bidding at HSB (members-only).
export function isHsbBlocked(club: ClubCode, who: WhoCode): boolean {
  return club === "hsb" && who === "nonmember";
}

// Which experiences are available given club + member status (locked ones
// excluded). Mirrors renderExps() gating.
export function availableExperiences(
  club: ClubCode,
  who: WhoCode,
): ExperienceDef[] {
  if (isComingSoon(club) || isHsbBlocked(club, who)) return [];
  return RULES.experiences[club];
}

export function isExperienceLocked(exp: ExperienceDef, who: WhoCode): boolean {
  return !!exp.membersOnly && who === "nonmember";
}

// The whole indicative computation — a pure port of the prototype recalc().
export function computeEstimate(s: IntakeState): EstimateResult {
  const adults = Math.max(0, s.adults || 0);
  const jrs = Math.max(0, s.juniors || 0);
  const guests = adults + jrs;
  const isMember = s.who === "member";
  const coming = isComingSoon(s.club);
  const hsbBlocked = isHsbBlocked(s.club, s.who);

  if (coming) {
    return {
      lines: [],
      total: 0,
      grandLabel: "Coming Soon",
      escalation: "",
      ctaLabel: "Notify me when it opens →",
      heat: false,
      comingSoon: true,
      hsbBlocked: false,
    };
  }
  if (hsbBlocked) {
    return {
      lines: [],
      total: 0,
      grandLabel: "Members only",
      escalation: "",
      ctaLabel: "Inquire about membership →",
      heat: false,
      comingSoon: false,
      hsbBlocked: true,
    };
  }

  const lines: EstimateLine[] = [];
  let total = 0;

  const exps = s.exps;
  const customVenue = exps.includes("facility");
  const usesGuestFee = exps.some(
    (e) => !["lesson", "training", "facility"].includes(e),
  );

  if (usesGuestFee) {
    const b = band(s.club, guests);
    if (b) {
      if (adults) {
        lines.push({ label: `Guest fee · ${adults} adult @ ${money(b.a)}`, amount: adults * b.a });
        total += adults * b.a;
      }
      if (jrs) {
        lines.push({ label: `Junior fee · ${jrs} @ ${money(b.j)}`, amount: jrs * b.j });
        total += jrs * b.j;
      }
    }
  }

  if (exps.includes("lesson")) {
    let cost = 0;
    const students = Math.max(1, guests);
    for (let i = 0; i < students; i++) {
      // 5-student cohort per instructor (1:5 ratio); the 6th student opens a
      // fresh cohort at the $200 Lead Slot rate, per Group Event Policy §9.2.
      cost += RULES.lessonLadder[i % 5];
    }
    lines.push({ label: `Private lesson · ${students} student ladder /hr`, amount: cost, exempt: true });
    total += cost;
  }

  if (customVenue) {
    lines.push({ label: "General facility usage · wedding / event space", amount: 0, tbd: true });
  }

  const disc = isMember ? 1 - RULES.memberRetailDiscount : 1;
  if (s.addons.ammo) {
    const c = s.addons.ammo * RULES.ammoBox * disc;
    lines.push({ label: `Ammunition · ${s.addons.ammo} box${s.addons.ammo > 1 ? "es" : ""}${isMember ? " (mbr)" : ""}`, amount: c });
    total += c;
  }
  if (s.addons.gear) {
    const c = s.addons.gear * RULES.gearPerPerson * disc;
    lines.push({ label: `Gear rental · ${s.addons.gear} person${isMember ? " (mbr)" : ""}`, amount: c });
    total += c;
  }
  if (s.addons.cart) {
    lines.push({ label: "Drink cart", amount: RULES.drinkCart });
    total += RULES.drinkCart;
  }

  if (s.catering) {
    const c = s.catering.per * guests;
    lines.push({ label: `Catering · ${s.catering.name} · ${guests} @ $${s.catering.per}/head`, amount: c });
    total += c;
  }

  if (s.staffMode && s.discountValue > 0) {
    const cut = s.discountType === "pct" ? total * (s.discountValue / 100) : s.discountValue;
    total = Math.max(0, total - cut);
    lines.push({
      label: `Staff discount (${s.discountType === "pct" ? s.discountValue + "%" : money(s.discountValue)})`,
      amount: -cut,
      negative: true,
    });
  }

  // Escalation guidance (RSO + instructor staffing).
  const rso = Math.ceil(guests / RULES.rsoPerGuests);
  const esc: string[] = [];
  if (guests >= RULES.rsoPerGuests) esc.push(`${rso} RSO${rso > 1 ? "s" : ""} (1 per 5 guests)`);
  if (guests >= RULES.secondInstructorAt) esc.push("two Senior Instructors required");
  else if (guests >= RULES.seniorInstructorAt) esc.push("Senior Instructor required");
  if (guests >= 9) esc.push("9+ → reservation / Private Event (72-hr notice)");

  // Heat advisory: summer (May–Sep) midday arrival.
  const arr = +s.arrival;
  const mo = s.date ? new Date(s.date).getMonth() + 1 : 0;
  const summer = mo >= 5 && mo <= 9;
  const heat = summer && (arr === 12 || arr === 13);

  const grandLabel = customVenue && total === 0 ? "Custom" : money(total);

  return {
    lines,
    total,
    grandLabel,
    escalation: esc.length ? "▲ " + esc.join(" · ") : "",
    ctaLabel: s.staffMode ? "Create request (on behalf) →" : "Request my estimate →",
    heat,
    comingSoon: false,
    hsbBlocked: false,
  };
}

// Whether the F&B catering card should show for this club/member combo.
export function cateringFor(club: ClubCode, who: WhoCode): CateringOption[] | null {
  const set = RULES.catering[club];
  if (!set) return null;
  if (isComingSoon(club) || isHsbBlocked(club, who)) return null;
  return set;
}
