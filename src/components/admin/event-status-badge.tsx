import { Badge } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";
import type { EventStatus } from "@/src/services/admin/events";
import type { EventFeatureRequest } from "@/src/services/ai/capability-requests";

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

// Beside a draft's status: part of it is waiting on a feature the helper
// sent to the developer, or that feature is now built and ready to add.
export function EventFeatureBadge({ requests }: { requests: ReadonlyArray<EventFeatureRequest> }) {
  if (requests.length === 0) return null;
  const waiting = requests.filter((request) => request.state === "waiting");
  const title = requests.map((request) => request.summary).join("\n");
  return waiting.length > 0 ? (
    <Badge variant="filling" title={title}>
      Waiting on a feature
    </Badge>
  ) : (
    <Badge variant="open" title={title}>
      Feature ready
    </Badge>
  );
}
