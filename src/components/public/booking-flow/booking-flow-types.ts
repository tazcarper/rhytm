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
  notes: string;
}

// Funnel state shape. Two field categories:
//
//   ALWAYS-DEFAULTED — required, populated by the provider's INITIAL_STATE.
//     Read directly (`state.guestCount`); never `state.guestCount ?? 1`.
//     If you find yourself reaching for `??` on one of these, the bug is
//     upstream — the default isn't being honored.
//
//   PROGRESSIVELY-SET — optional, becomes defined as the user moves through
//     the funnel. Genuine `?? default` reads are fine here only when the
//     reader has no upstream guard guaranteeing the value is set.
//
// At the submit boundary, narrow via `isSubmittable(state)` (below) instead
// of checking each field — single source of truth for "ready to submit".
export interface BookingFlowState {
  // ---- always defaulted ----
  guestCount: number;
  disciplineSelections: ReadonlyArray<DisciplineSelection>;

  // ---- progressively set ----
  bookingType?: BookingType;
  // ISO strings, not Date objects, so the provider value stays
  // structurally comparable across renders.
  date?: string;
  slotStart?: string;
  durationHours?: number;
  instructorId?: string | null;
  guest?: Partial<GuestInfo>;
}

// All required fields present, ready to call the 2.6 submit action.
// `isSubmittable` is the canonical narrow.
export interface SubmittableBookingState extends BookingFlowState {
  bookingType: BookingType;
  date: string;
  slotStart: string;
  durationHours: number;
  guest: GuestInfo;
}

export function isSubmittable(
  state: BookingFlowState,
): state is SubmittableBookingState {
  if (state.bookingType === undefined) return false;
  if (state.date === undefined) return false;
  if (state.slotStart === undefined) return false;
  if (state.durationHours === undefined) return false;
  if (!state.guest) return false;
  if (!state.guest.name || !state.guest.email || !state.guest.phone) return false;
  return true;
}

export type BookingFlowRequiredKey = keyof BookingFlowState;

export const BOOKING_RESET_PARAM = "reset";
export const BOOKING_RESET_VALUE = "1";

export function buildBookingResetUrl(propertySlug: string): string {
  return `/book/${propertySlug}?${BOOKING_RESET_PARAM}=${BOOKING_RESET_VALUE}`;
}
