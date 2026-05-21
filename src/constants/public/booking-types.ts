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
    bullets: [
      "Choose one, two, or three hours",
      "Paired with an instructor on the day",
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
