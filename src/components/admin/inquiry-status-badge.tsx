import { Badge } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";
import type { InquiryStatus } from "@/src/services/admin/inquiries";

const STATUS_VARIANT: Record<InquiryStatus, BadgeVariant> = {
  new: "open",
  resolved: "past",
};

const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "New",
  resolved: "Resolved",
};

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
