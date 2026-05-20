import type { ReactNode } from "react";
import { BookingFlowProvider } from "@/src/components/public/booking-flow/booking-flow-provider";

// Slug is validated by the page (single fetch). This layout's only
// job is to mount the funnel provider so state survives step nav.
export default function BookingPropertyLayout({
  children,
}: {
  children: ReactNode;
  params: Promise<{ property: string }>;
}) {
  return <BookingFlowProvider>{children}</BookingFlowProvider>;
}
