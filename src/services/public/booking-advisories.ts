// Non-pricing booking advisories — the RSO ratio, instructor escalation, the
// 9+ Private-Event reservation flag, and the summer heat warning. Extracted
// VERBATIM from the estimate prototype (the inline block that used to live in
// rules.ts computeEstimate) so the public form, the submit action, and any
// admin/bid surface all derive the SAME flags from one place (plan §8). These
// are flags and escalations, never prices — pricing stays in rules.ts.

export const ADVISORY_THRESHOLDS = {
  rsoPerGuests: 5, // 1 RSO per 5 guests (members excluded)
  seniorInstructorAt: 15, // Senior Instructor at 15+ guests
  secondInstructorAt: 20, // two Senior Instructors at 20+ guests
  privateEventAt: 9, // 9+ TOTAL heads ⇒ Private Event (72-hr notice)
} as const;

export interface AdvisoryInput {
  // Non-member guests only — they drive the RSO + instructor ratios.
  guests: number;
  // Members + guests — drives the Private Event reservation flag.
  totalHead: number;
  // Arrival hour as a string ("9".."15"); a midday arrival triggers the heat
  // advisory in summer.
  arrival: string;
  // Booking date (YYYY-MM-DD) or "" — its month drives the summer window.
  date: string;
}

export interface BookingAdvisories {
  rsoCount: number;
  requiresSeniorInstructor: boolean;
  requiresTwoSeniorInstructors: boolean;
  isPrivateEvent: boolean;
  heatWarning: boolean;
  // Human-readable escalation fragments, in display order.
  escalationParts: string[];
  // The single-line escalation label the form shows ("▲ a · b"), or "".
  escalationLabel: string;
}

export function computeBookingAdvisories(
  input: AdvisoryInput,
): BookingAdvisories {
  const guests = Math.max(0, input.guests || 0);
  const totalHead = Math.max(0, input.totalHead || 0);

  const rsoCount = Math.ceil(guests / ADVISORY_THRESHOLDS.rsoPerGuests);
  const requiresTwoSeniorInstructors =
    guests >= ADVISORY_THRESHOLDS.secondInstructorAt;
  const requiresSeniorInstructor =
    !requiresTwoSeniorInstructors &&
    guests >= ADVISORY_THRESHOLDS.seniorInstructorAt;
  const isPrivateEvent = totalHead >= ADVISORY_THRESHOLDS.privateEventAt;

  const escalationParts: string[] = [];
  if (guests >= ADVISORY_THRESHOLDS.rsoPerGuests) {
    escalationParts.push(
      `${rsoCount} RSO${rsoCount > 1 ? "s" : ""} (1 per 5 guests, members excluded)`,
    );
  }
  if (requiresTwoSeniorInstructors) escalationParts.push("two Senior Instructors");
  else if (requiresSeniorInstructor) escalationParts.push("Senior Instructor");
  if (isPrivateEvent) {
    escalationParts.push("9+ total → reservation / Private Event (72-hr notice)");
  }

  // Verbatim: original used `+s.arrival` and `new Date(s.date).getMonth()+1`.
  const arrivalHour = Number(input.arrival);
  const month = input.date ? new Date(input.date).getMonth() + 1 : 0;
  const isSummer = month >= 5 && month <= 9;
  const heatWarning = isSummer && (arrivalHour === 12 || arrivalHour === 13);

  return {
    rsoCount,
    requiresSeniorInstructor,
    requiresTwoSeniorInstructors,
    isPrivateEvent,
    heatWarning,
    escalationParts,
    escalationLabel: escalationParts.length
      ? "▲ " + escalationParts.join(" · ")
      : "",
  };
}
