"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { BookingFlowState } from "./booking-flow-types";

// Funnel state. Refresh resets — see feedback_booking_funnel_state.md.

interface BookingFlowContextValue {
  state: BookingFlowState;
  setState: (patch: Partial<BookingFlowState>) => void;
  reset: () => void;
}

const BookingFlowContext = createContext<BookingFlowContextValue | null>(null);

// Sensible defaults that the funnel UI displays from step 1. Set here (not
// in the components that consume them) so there's no undefined window
// between provider mount and the consumer's first render. Reading these
// fields downstream uses `state.guestCount` directly — never `?? default`.
const INITIAL_STATE: BookingFlowState = {
  guestCount: 1,
  disciplineSelections: [],
};

export function BookingFlowProvider({ children }: { children: ReactNode }) {
  const [state, setStateInternal] = useState<BookingFlowState>(INITIAL_STATE);

  const setState = useCallback((patch: Partial<BookingFlowState>) => {
    setStateInternal((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setStateInternal(INITIAL_STATE);
  }, []);

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
