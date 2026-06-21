// ===== ENCODED RULES — the executable spec =====
// Ported verbatim from Rhythm_Event_Intake_Prototype.html (corrected model),
// verified against the canonical Pricing DB SKUs. Source of truth for the
// indicative estimate math:
//   - host-of-record + party composition: members (shoot on dues) vs
//     non-member guests (drive fees + ratios); a party can be 2 members
//     hosting 10 guests.
//   - guest fees tier by GUEST count (members excluded); 9+ TOTAL head is a
//     reservation flag (Private Event, 72-hr), NOT a price change.
//   - private lesson = flat ladder (i % 5 cohort) × hours, 2-hr standard,
//     all participants, tax-exempt.
//   - classes/clinics: members at member rate, guests at public rate.
//   - HH/PSP catering × total headcount; HSB members-only block applies to a
//     non-member host only; Packsaddle "Coming Soon".
//
// INDICATIVE ONLY. The binding price is staff-built on the bid — this math
// drives the live preview and the stored `indicative_total` display string,
// nothing that moves money. Expect the numbers/copy to change (Ryan/Stitch
// later); the logic lives here, isolated, so that swap stays cheap.

export type ClubCode = "hsb" | "hh" | "psp";
// The host of record. A member host may bring non-member guests; a
// non-member host books direct (and is blocked at HSB).
export type HostCode = "member" | "nonmember";

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
  // A group class / clinic priced per-head by member vs public rate
  // (classPrice), excluded from the guest-fee path.
  klass?: boolean;
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
  // Guest fee tiered by GUEST count (members excluded), per canonical Pricing
  // DB SKUs. HH: PRC-21 (1-4 $50) · PRC-22 (5-9 $75) · PRC-23 (10-14 $95) ·
  // 15-19 $115 · 20-24 $125. 9+ TOTAL head = Private Event (advance
  // reservation) — a separate flag, NOT a price change.
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
  rsoPerGuests: 5, // 1 RSO per 5 guests
  seniorInstructorAt: 15, // +senior instructor
  secondInstructorAt: 20, // +second senior instructor
  // Per student in a 5-student cohort (1:5 ratio); the 6th student opens a
  // fresh cohort at the $200 Lead Slot rate (i % 5).
  lessonLadder: [200, 100, 50, 50, 50],
  ammoBox: 17,
  gearPerPerson: 40,
  drinkCart: 75,
  memberRetailDiscount: 0.2,
  standardBlockHrs: 2,
  experiences: {
    hsb: [
      { id: "clays", t: "Sporting Clays", d: "2-hr block · cart + clays", lesson: false },
      { id: "pistol", t: "Pistol / Carbine Bay", d: "2-hr bay session", lesson: false },
      { id: "lesson", t: "Private Lesson", d: "Hourly · 2-hr recommended", lesson: true },
      { id: "class", t: "Clinic / League", d: "Group class · $65 / person", lesson: false, klass: true },
      { id: "event", t: "Tournament / Event", d: "Registered event", lesson: false, membersOnly: true },
    ] as ExperienceDef[],
    hh: [
      { id: "clays", t: "Sporting Clays", d: "2-hr block · cart + clays", lesson: false },
      { id: "pistol", t: "Pistol Bay", d: "2-hr bay session", lesson: false },
      { id: "lesson", t: "Private Lesson", d: "Hourly · 2-hr recommended", lesson: true },
      { id: "class", t: "Class / Clinic", d: "Free for members · $200 public", lesson: false, klass: true },
      { id: "event", t: "Event", d: "Registered event", lesson: false },
      { id: "facility", t: "General Facility Usage", d: "Wedding · bridal · event space", lesson: false, custom: true },
    ] as ExperienceDef[],
    psp: [] as ExperienceDef[],
  },
  comingSoon: { psp: true } as Partial<Record<ClubCode, boolean>>,
  // Class / clinic pricing per club (Notion: HH free-member / $200 public ·
  // HSB clinic $65). Member-aware.
  classPrice: {
    hsb: { m: 65, n: 65 },
    hh: { m: 0, n: 200 },
  } as Partial<Record<ClubCode, { m: number; n: number }>>,
  addons: [
    { id: "ammo", nm: "Ammunition", shape: "qty", unit: "box", meta: "~1 box / 25 targets · $17 (HSB rate · HH/PSP TBD)" },
    { id: "gear", nm: "Firearm / gear rental", shape: "perperson", meta: "per shooter · retail $40" },
    { id: "cart", nm: "Extra drink cart", shape: "bool", meta: "yes / no" },
  ] as AddonDef[],
  // F&B catering — HH + Packsaddle ONLY. (HSB dining runs through The Club.)
  // Placeholder vendors + indicative per-head — confirm before sign-off.
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

// A staff-added flat line (Musical Guest, Snake Trainer, Hair & Makeup, …).
export interface CustomLine {
  label: string;
  amount: number;
}

export interface IntakeState {
  host: HostCode;
  club: ClubCode;
  exps: string[];
  addons: AddonState;
  catering: CateringOption | null;
  // Party composition. members shoot on dues (only meaningful for a member
  // host); guestAdults/guestJuniors are non-member guests that drive fees.
  members: number;
  guestAdults: number;
  guestJuniors: number;
  // Private lesson length in hours (2-hr standard block).
  hours: number;
  // Staff-only fields.
  staffMode: boolean;
  discountValue: number;
  discountType: "pct" | "amt";
  customLines: CustomLine[];
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
  // 9+ total headcount → Private Event (advance reservation). A flag only.
  isEvent: boolean;
}

export function money(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

function guestRate(club: ClubCode, guests: number): FeeBand | null {
  const t = RULES.guestFee[club];
  if (!t) return null;
  return t.find((b) => guests <= b.max) ?? t[t.length - 1];
}

// True when this club currently shows the "Coming Soon" gate.
export function isComingSoon(club: ClubCode): boolean {
  return !!RULES.comingSoon[club];
}

// True when a non-member host is blocked from booking at HSB (members-only).
// A member host bringing non-member guests is allowed.
export function isHsbBlocked(club: ClubCode, host: HostCode): boolean {
  return club === "hsb" && host === "nonmember";
}

// Which experiences are available given club + host (locked ones excluded).
export function availableExperiences(
  club: ClubCode,
  host: HostCode,
): ExperienceDef[] {
  if (isComingSoon(club) || isHsbBlocked(club, host)) return [];
  return RULES.experiences[club];
}

export function isExperienceLocked(exp: ExperienceDef, host: HostCode): boolean {
  return !!exp.membersOnly && host === "nonmember";
}

// The whole indicative computation — a pure port of the corrected prototype
// recalc(). members shoot on dues (no guest fee); guests drive fees + ratios.
export function computeEstimate(s: IntakeState): EstimateResult {
  const memberHost = s.host === "member";
  const members = memberHost ? Math.max(0, s.members || 0) : 0;
  const gAdults = Math.max(0, s.guestAdults || 0);
  const gJrs = Math.max(0, s.guestJuniors || 0);
  const guests = gAdults + gJrs; // non-member guests
  const totalHead = members + guests;
  const isMember = memberHost;

  const coming = isComingSoon(s.club);
  const hsbBlocked = isHsbBlocked(s.club, s.host);

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
      isEvent: false,
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
      isEvent: false,
    };
  }

  const lines: EstimateLine[] = [];
  let total = 0;

  const exps = s.exps;
  const customVenue = exps.includes("facility");
  // Guest fees apply to any experience that isn't a class/facility/training.
  const usesGuestFee = exps.some(
    (e) => !["training", "facility", "class"].includes(e),
  );

  // Guest fees on GUESTS only (members excluded), tiered by guest count.
  if (usesGuestFee && guests > 0) {
    const r = guestRate(s.club, guests);
    if (r) {
      if (gAdults) {
        lines.push({ label: `Guest fee · ${gAdults} guest adult @ ${money(r.a)}`, amount: gAdults * r.a });
        total += gAdults * r.a;
      }
      if (gJrs) {
        lines.push({ label: `Junior guest fee · ${gJrs} @ ${money(r.j)}`, amount: gJrs * r.j });
        total += gJrs * r.j;
      }
    }
  }

  // Private lesson — flat hourly ladder × hours (2-hr standard), all
  // participants (members + guests). The member/non-member difference is the
  // guest fee above, not a different lesson rate.
  if (exps.includes("lesson")) {
    const hrs = s.hours || RULES.standardBlockHrs;
    const students = Math.max(1, totalHead);
    let perHr = 0;
    for (let i = 0; i < students; i++) {
      perHr += RULES.lessonLadder[i % 5]; // cohort of 5 per instructor
    }
    const cost = perHr * hrs;
    lines.push({ label: `Private lesson · ${students} student${students > 1 ? "s" : ""} × ${hrs} hr`, amount: cost, exempt: true });
    total += cost;
  }

  // Class / clinic — members at member rate, guests at public rate.
  if (exps.includes("class")) {
    const cp = RULES.classPrice[s.club];
    if (cp) {
      if (members) {
        const c = members * cp.m;
        lines.push({ label: `Class · ${members} member${members > 1 ? "s" : ""} × ${cp.m ? money(cp.m) : "free"}`, amount: c });
        total += c;
      }
      if (gAdults) {
        const c = gAdults * cp.n;
        lines.push({ label: `Class · ${gAdults} guest${gAdults > 1 ? "s" : ""} × ${money(cp.n)}`, amount: c });
        total += c;
      }
    }
  }

  if (customVenue) {
    lines.push({ label: "General facility usage · wedding / event space", amount: 0, tbd: true });
  }

  // Add-ons (member 20% off retail goods).
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

  // F&B catering (HH / PSP) — per-head × total headcount (everyone eats).
  if (s.catering) {
    const c = s.catering.per * totalHead;
    lines.push({ label: `Catering · ${s.catering.name} · ${totalHead} @ $${s.catering.per}/head`, amount: c });
    total += c;
  }

  // Staff manual line items (staff mode only).
  if (s.staffMode) {
    for (const c of s.customLines) {
      lines.push({ label: `${c.label} · custom`, amount: c.amount });
      total += c.amount;
    }
  }

  // Staff discount.
  if (s.staffMode && s.discountValue > 0) {
    const cut = s.discountType === "pct" ? total * (s.discountValue / 100) : s.discountValue;
    total = Math.max(0, total - cut);
    lines.push({
      label: `Staff discount (${s.discountType === "pct" ? s.discountValue + "%" : money(s.discountValue)})`,
      amount: -cut,
      negative: true,
    });
  }

  // Escalation — guests drive ratios (members excluded); reservation by total.
  const rso = Math.ceil(guests / RULES.rsoPerGuests);
  const esc: string[] = [];
  if (guests >= RULES.rsoPerGuests) esc.push(`${rso} RSO${rso > 1 ? "s" : ""} (1 per 5 guests, members excluded)`);
  if (guests >= RULES.secondInstructorAt) esc.push("two Senior Instructors");
  else if (guests >= RULES.seniorInstructorAt) esc.push("Senior Instructor");
  if (totalHead >= 9) esc.push("9+ total → reservation / Private Event (72-hr notice)");

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
    isEvent: totalHead >= 9,
  };
}

// Whether the F&B catering card should show for this club/host combo.
export function cateringFor(club: ClubCode, host: HostCode): CateringOption[] | null {
  const set = RULES.catering[club];
  if (!set) return null;
  if (isComingSoon(club) || isHsbBlocked(club, host)) return null;
  return set;
}
