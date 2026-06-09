import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";

export interface BookingTypeMeta {
  type: BookingType;
  ordinal: string;
  title: string;
  description: string;
  durationLabel: string;
  // Hours written to bookings.duration_hours when this type is picked
  // and no duration selector has overridden it. Plan a Visit is fixed at 2;
  // the others use the range minimum until App 2.5 adds explicit selection.
  defaultDurationHours: number;
  // When true, the WHEN step is instructor-first: the guest picks a qualified
  // instructor and the calendar/slots reflect that instructor's availability.
  // Drives all funnel branching (Open/Closed) — no scattered booking-type checks.
  requiresInstructor?: boolean;
  bullets: ReadonlyArray<string>;
  notice?: string;
}

export const BOOKING_TYPE_META: Record<BookingType, BookingTypeMeta> = {
  plan_a_visit: {
    type: "plan_a_visit",
    ordinal: "I",
    title: "Plan a Visit",
    description:
      "Come out and shoot — an open-format afternoon on the range.",
    durationLabel: "Two hours",
    defaultDurationHours: 2,
    bullets: [
      "Fixed two-hour window",
      "Open format on the range",
      "Pricing confirmed within 24 hours",
    ],
  },
  private_lesson: {
    type: "private_lesson",
    ordinal: "II",
    title: "Private Lesson",
    description:
      "One-on-one with an instructor. Sharpen technique on your terms.",
    durationLabel: "One to three hours",
    defaultDurationHours: 1,
    requiresInstructor: true,
    bullets: [
      "Choose one, two, or three hours",
      "Pick your instructor when you book",
      "Solo or with a guest",
    ],
  },
  host_an_occasion: {
    type: "host_an_occasion",
    ordinal: "III",
    title: "Host an Occasion",
    description:
      "Tournaments, milestones, corporate days — the whole property, all yours.",
    durationLabel: "Two to six hours",
    defaultDurationHours: 2,
    bullets: [
      "Exclusive use of the property",
      "Tailored to your group's plans",
      "Team-quoted within 24 hours",
    ],
    notice:
      "Exclusive use — your booking blocks all other guests at this property during your window.",
  },
};

export const BOOKING_TYPE_ORDER: ReadonlyArray<BookingType> = [
  "plan_a_visit",
  "private_lesson",
  "host_an_occasion",
];
