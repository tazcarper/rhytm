import { Badge } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";

type PromotionStatus = "draft" | "published" | "archived";

// Promotion lifecycle on the shared brand badge vocabulary: draft = tan
// (in-progress, not live), published = green (live), archived = gray
// (retired but kept for a re-run).
const STATUS_VARIANT: Record<PromotionStatus, BadgeVariant> = {
  draft: "draft",
  published: "open",
  archived: "past",
};

const STATUS_LABEL: Record<PromotionStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
