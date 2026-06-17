"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { BookingFlowState, GuestInfo } from "./booking-flow-types";

// Funnel state. Refresh resets — see feedback_booking_funnel_state.md.

interface BookingFlowContextValue {
  state: BookingFlowState;
  setState: (patch: Partial<BookingFlowState>) => void;
  reset: () => void;
}

const BookingFlowContext = createContext<BookingFlowContextValue | null>(null);

// Build INITIAL_STATE per mount. The defaulted fields (guestCount,
// disciplineSelections) are constants; `guest` is seeded from the
// signed-in member's profile when the layout passes it in. Computing
// the object at mount avoids sharing a frozen reference across
// browser sessions, which would otherwise leak prefill from one
// session to the next during HMR.
function buildInitialState(initialGuest: Partial<GuestInfo> | null): BookingFlowState {
  const base: BookingFlowState = {
    guestCount: 1,
    juniorGuestCount: 0,
    disciplineSelections: [],
  };
  if (initialGuest) {
    base.guest = initialGuest;
  }
  return base;
}

export function BookingFlowProvider({
  children,
  initialGuest = null,
}: {
  children: ReactNode;
  initialGuest?: Partial<GuestInfo> | null;
}) {
  const [state, setStateInternal] = useState<BookingFlowState>(() =>
    buildInitialState(initialGuest),
  );

  const setState = useCallback((patch: Partial<BookingFlowState>) => {
    setStateInternal((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setStateInternal(buildInitialState(initialGuest));
  }, [initialGuest]);

  return (
    <BookingFlowContext.Provider value={{ state, setState, reset }}>
      {children}
    </BookingFlowContext.Provider>
  );
}

export function useBookingFlow(): BookingFlowContextValue {
  const ctx = useContext(BookingFlowContext);
  if (!ctx) {
    throw new Error(
      "useBookingFlow must be called inside a <BookingFlowProvider>.",
    );
  }
  return ctx;
}
