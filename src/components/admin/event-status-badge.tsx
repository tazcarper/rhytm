import { Badge } from "@/lib/ui";
import { InfoTip } from "@/src/components/ui/info-tip";
import { InProgressIndicator } from "./in-progress-indicator";
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

// Beside a draft's status: part of it is a feature the AI helper sent to
// the developer to build ("in progress"), or that feature is now built and
// can be added ("ready"). The ⓘ explains what that means and names it.
export function EventFeatureBadge({ requests }: { requests: ReadonlyArray<EventFeatureRequest> }) {
  if (requests.length === 0) return null;
  const waiting = requests.filter((request) => request.state === "waiting");
  const inProgress = waiting.length > 0;
  const listed = inProgress ? waiting : requests;
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={inProgress ? "filling" : "open"} className="inline-flex items-center gap-1.5">
        {inProgress && <InProgressIndicator size={12} />}
        {inProgress ? "Feature in progress" : "Feature ready"}
      </Badge>
      <InfoTip label={inProgress ? "What does Feature in progress mean?" : "What does Feature ready mean?"}>
        {inProgress ? (
          <>
            Part of this event needs something the event builder can't do yet, so it was sent to the developer to
            build:
          </>
        ) : (
          <>The feature this event was waiting on has been built:</>
        )}
        <ul className="my-1.5 list-disc pl-4">
          {listed.map((request) => (
            <li key={request.requestId}>{request.summary}</li>
          ))}
        </ul>
        {inProgress
          ? "The rest of the draft is saved. It can't be published until that part is built."
          : "Open the event to add it, then publish."}
      </InfoTip>
    </span>
  );
}
