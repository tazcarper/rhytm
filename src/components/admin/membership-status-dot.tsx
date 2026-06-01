import type { MembershipStatus } from "@/src/services/admin/members";
import { membershipStatusLabel } from "./membership-status-badge";
import s from "./membership-status-dot.module.css";

// Compact status indicator for dense, stacked lists (the members table).
// Active is the quiet default — a bare green dot — so the eye skips it and
// lands on the exceptions, which get both a colored dot and a word.
// Colors mirror the badge palette hues.
const STATUS_COLOR: Record<MembershipStatus, string> = {
  active: "#3f6e32", // green
  pending: "#b8821e", // amber
  lapsed: "#b8641e", // orange
  suspended: "#8c3232", // red
  inactive: "#8a8a7d", // gray
};

export function MembershipStatusDot({ status }: { status: MembershipStatus }) {
  const label = membershipStatusLabel(status);
  return (
    <span className={s.wrap} role="img" aria-label={label} title={label}>
      <span
        className={s.dot}
        style={{ backgroundColor: STATUS_COLOR[status] }}
        aria-hidden="true"
      />
      {status !== "active" && <span className={s.label}>{label}</span>}
    </span>
  );
}
