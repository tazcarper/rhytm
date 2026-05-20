export type BookingType =
  | "plan_a_visit"
  | "private_lesson"
  | "host_an_occasion";

export interface DisciplineSelection {
  serviceId: string;
  addOns: ReadonlyArray<{ addOnId: string; quantity: number }>;
}

export interface GuestInfo {
  name: string;
  email: string;
  phone: string;
  count: number;
  notes: string;
}

export interface BookingFlowState {
  bookingType?: BookingType;
  disciplineSelections?: ReadonlyArray<DisciplineSelection>;
  // ISO strings, not Date objects, so the provider value stays
  // structurally comparable across renders.
  date?: string;
  slotStart?: string;
  instructorId?: string | null;
  guest?: Partial<GuestInfo>;
}

export type BookingFlowRequiredKey = keyof BookingFlowState;

export const BOOKING_RESET_PARAM = "reset";
export const BOOKING_RESET_VALUE = "1";

export function buildBookingResetUrl(propertySlug: string): string {
  return `/book/${propertySlug}?${BOOKING_RESET_PARAM}=${BOOKING_RESET_VALUE}`;
}
