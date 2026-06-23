"use server";

import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/auth/portal";
import { checkRateLimit, clientIpFrom } from "@/src/services/security/rate-limit";
import { createPublicBooking } from "@/src/services/bookings/create-public-booking";
import {
  CLUB_TO_SLUG,
  RULES,
  computeEstimate,
  type ClubCode,
  type EstimateLine,
  type IntakeState,
} from "@/src/components/public/estimate-intake/rules";

// Thin submit boundary for the public estimate front door. As of the
// request-estimate → bid integration (plan §3/§7), a submit produces the SAME
// artifact /book does: a real Booking + quote-only Bid via createPublicBooking().
// The guest is redirected to their unique bid URL ("your bid is being
// prepared"); staff see it in /admin/bids. There is no lead row anymore.
//
// Honeypot + rate limit first; then identity is resolved server-side (never
// trusted from the form). The indicative quote is RECOMPUTED here from the
// structured inputs via the same computeEstimate() the page shows — so the
// carried price can't be tampered with in transit — and carried onto the bid
// as its starting line breakdown (discounts/custom lines excluded, plan §7/§8).

export interface SubmitEstimateInput {
  // Club selection as the seeded property slug (horseshoe-bay / hog-heaven /
  // packsaddle). Resolved to property_id server-side.
  propertySlug: string;
  // Host of record. A member host may bring non-member guests.
  host: "member" | "nonmember";
  experiences: string[];
  addons: { ammo: number; gear: number; cart: boolean };
  catering: { tier: string; name: string; per: number } | null;
  // Party composition.
  members: number;
  guestAdults: number;
  guestJuniors: number;
  lessonHours: number | null;
  customLines: { label: string; amount: number }[];
  name: string;
  email: string;
  phone: string;
  preferredDate: string;
  backupDate: string;
  arrival: string;
  notes: string;
  indicativeTotal: string;
  // Staff phone-intake context (only honored when the caller is signed-in
  // staff).
  staffMode: boolean;
  staffRepName: string;
}

export type SubmitEstimateResult =
  | { ok: true; bidPath: string }
  | { ok: false; message: string };

// Club ↔ slug, reversed: resolve the submitted property slug back to the
// ClubCode computeEstimate() keys its pricing off.
const SLUG_TO_CLUB: Record<string, ClubCode> = Object.fromEntries(
  (Object.entries(CLUB_TO_SLUG) as [ClubCode, string][]).map(
    ([club, slug]) => [slug, club],
  ),
);

const round2 = (n: number): number => Math.round(n * 100) / 100;

type CarriedKind =
  | "base_experience"
  | "guest_fee"
  | "add_on"
  | "instructor"
  | "fee"
  | "other";

// Best-effort kind classification for a carried estimate line. The model has
// no discount kind by design (discounts live in the override path), so anything
// without a clear match falls to "other" (plan §8). Tax-exempt lines are the
// private lesson — the core experience.
function carriedKind(line: EstimateLine): CarriedKind {
  if (line.tbd) return "other";
  if (/guest fee/i.test(line.label)) return "guest_fee";
  if (line.exempt) return "base_experience";
  return "other";
}

// A provisional booking date when the guest didn't pick one. The slot is not
// enforced while pending_review (plan §6), so this only satisfies the NOT-NULL
// start_time column; staff set the real date at lock time.
function provisionalDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

export async function submitEstimateAction(
  input: SubmitEstimateInput,
  // Honeypot — a hidden field real users never fill.
  honeypot?: string,
): Promise<SubmitEstimateResult> {
  if (honeypot && honeypot.trim().length > 0) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }

  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders.get("x-forwarded-for"));
  const email = input.email?.trim().toLowerCase() ?? "";
  if (ip && !(await checkRateLimit(`estimate:ip:${ip}`, 10, 600))) {
    return { ok: false, message: "Too many requests — wait a minute and try again." };
  }
  if (email && !(await checkRateLimit(`estimate:email:${email}`, 5, 600))) {
    return { ok: false, message: "Too many requests for this email — wait a few minutes." };
  }

  const supabase = await createServerSupabaseClient();

  // Resolve the club slug to a property id + ClubCode. Both are required to
  // build a real booking and price it; an unmapped/Coming-Soon club can't.
  const club = SLUG_TO_CLUB[input.propertySlug];
  let propertyId: string | null = null;
  if (input.propertySlug) {
    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", input.propertySlug)
      .maybeSingle();
    propertyId = (property as { id: string } | null)?.id ?? null;
  }
  if (!propertyId || !club) {
    return {
      ok: false,
      message: "We couldn't match that club. Please contact us to book.",
    };
  }

  // Identity is computed from the session, never from the form. Only a
  // signed-in staff member may attribute an intake to themselves (phone intake).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role as string | undefined;
  const isStaff = hasAdminAccess(role);
  const staffIntake = isStaff && input.staffMode;

  // Recompute the indicative quote server-side from the structured inputs.
  // staffMode is forced OFF here so the carried lines are the pure catalog
  // breakdown — no staff discount (carried via the audited override path
  // instead) and no staff custom lines (total-override + note path instead).
  // That makes the carried subtotal the pre-discount total (plan §7/§8).
  const intake: IntakeState = {
    host: input.host,
    club,
    exps: input.experiences,
    addons: input.addons,
    catering: input.catering,
    members: input.host === "member" ? Math.max(0, input.members) : 0,
    guestAdults: Math.max(0, input.guestAdults),
    guestJuniors: Math.max(0, input.guestJuniors),
    hours: input.lessonHours ?? RULES.standardBlockHrs,
    staffMode: false,
    discountValue: 0,
    discountType: "pct",
    customLines: [],
    arrival: input.arrival ?? "",
    date: input.preferredDate ?? "",
  };
  const quote = computeEstimate(intake);

  if (quote.comingSoon) {
    return {
      ok: false,
      message: "This club isn't open for booking yet. Leave us a note and we'll reach out when it opens.",
    };
  }

  const carriedLines = quote.lines
    .filter((line) => !line.negative)
    .map((line) => ({
      kind: carriedKind(line),
      label: line.label,
      quantity: 1,
      unitAmount: round2(line.amount),
      lineAmount: round2(line.amount),
      taxStatus: line.exempt ? ("exempt" as const) : ("taxable" as const),
    }));

  if (carriedLines.length === 0) {
    return {
      ok: false,
      message: "Please pick at least one experience so we can prepare your bid.",
    };
  }

  // estimated_price is the pre-discount catalog subtotal (= the carried lines),
  // not quote.total (which would net out a staff discount we don't carry).
  const estimatedPrice = round2(
    carriedLines.reduce((sum, line) => sum + line.lineAmount, 0),
  );

  // Party: guest_count is total heads; junior_guest_count the juniors. Members
  // shoot on dues but still occupy the party. Floor at 1 to satisfy the CHECK.
  const totalHeads = intake.members + intake.guestAdults + intake.guestJuniors;
  const guestCount = Math.max(1, totalHeads);
  const juniorGuestCount = Math.min(intake.guestJuniors, guestCount);

  // Provisional slot — preferred date + arrival hour. Not enforced while
  // pending_review (plan §6); staff lock the real slot at confirm.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.preferredDate)
    ? input.preferredDate
    : provisionalDate();
  const arrivalHour = Number.parseInt(input.arrival ?? "", 10);
  const slotStart =
    Number.isInteger(arrivalHour) && arrivalHour >= 0 && arrivalHour <= 23
      ? `${String(arrivalHour).padStart(2, "0")}:00`
      : "09:00";

  // guest_notes is GUEST-VISIBLE on the bid page, so ONLY the guest's own note
  // goes here. Staff-facing intake context — host intent + "verify membership"
  // (host is taken on trust, plan §3.5), the backup date, any internal/phone
  // notes, and the advisory flags — needs the staff_notes/schedule_notes
  // channel that doesn't exist on bookings yet. Phase C adds that column and
  // carries them; until then they're intentionally deferred, never leaked into
  // the guest's view. (input.backupDate / staffRepName / staff internal notes
  // are accepted on the payload but not yet persisted.)
  const guestNotes = (input.notes ?? "").trim();

  const result = await createPublicBooking({
    propertyId,
    // Every estimate entry is a generic public visit: no instructor assigned or
    // scheduled this version (plan §3.2). A chosen lesson is priced (carried
    // line) but the booking stays plan_a_visit — whose DB CHECK pins
    // duration_hours to exactly 2, so lesson length only affects the price.
    bookingType: "plan_a_visit",
    audienceType: "public",
    date,
    slotStart,
    durationHours: 2,
    instructorId: null,
    guest: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? "",
      notes: guestNotes,
    },
    guestCount,
    juniorGuestCount,
    estimatedPrice,
    // Catalog UUID wiring (booking_disciplines / booking_add_ons) is Phase C;
    // the priced lines ride on bid_line_items regardless of structure.
    disciplineIds: [],
    addOns: [],
    // Host membership is on trust — no authenticated member here; admin
    // verifies on the dashboard. audience stays public.
    memberUserId: null,
    createdByAdminId: staffIntake ? user!.id : null,
    lineItems: carriedLines,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, bidPath: result.bidPath };
}
