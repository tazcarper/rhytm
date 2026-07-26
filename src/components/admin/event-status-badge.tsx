import { Badge } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";
import type { EventStatus } from "@/src/services/admin/events";

const STATUS_VARIANT: Record<EventStatus, BadgeVariant> = {
  draft: "draft",
  published: "open",
  sold_out: "full",
  cancelled: "neutral",
  completed: "past",
};

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Draft",
  published: "Published",
  sold_out: "Sold out",
  cancelled: "Cancelled",
  completed: "Completed",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
