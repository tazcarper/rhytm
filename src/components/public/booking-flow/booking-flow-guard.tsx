"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useBookingFlow } from "./booking-flow-provider";
import {
  buildBookingResetUrl,
  type BookingFlowRequiredKey,
} from "./booking-flow-types";

// Provider state lives in React only, so the prerequisite check has
// to run after hydration — server-rendered HTML can't see it.

export function BookingFlowGuard({
  requires,
  children,
}: {
  requires: ReadonlyArray<BookingFlowRequiredKey>;
  children: ReactNode;
}) {
  const router = useRouter();
  const { property: propertySlug } = useParams<{ property: string }>();
  const { state } = useBookingFlow();

  const hasAll = requires.every(
    (key) => state[key] !== undefined && state[key] !== null,
  );

  useEffect(() => {
    if (hasAll) return;
    router.replace(buildBookingResetUrl(propertySlug));
  }, [hasAll, propertySlug, router]);

  if (!hasAll) return null;
  return <>{children}</>;
}
