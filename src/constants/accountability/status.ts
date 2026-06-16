import type { BadgeVariant } from "@/lib/ui";
import type { OrgSeatStatus } from "@/src/types/accountability";

// Display label + badge color for each seat status.
export const STATUS_META: Record<
  OrgSeatStatus,
  { label: string; variant: BadgeVariant }
> = {
  active: { label: "Filled", variant: "open" },
  open: { label: "Open seat", variant: "draft" },
  hopeful: { label: "Hopeful", variant: "filling" },
};
