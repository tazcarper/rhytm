// Status badges for an instructor, shared by the roster list and the profile
// header so the wording/mapping never drifts between the two surfaces.
//
// Two independent badges:
//   1. Always: the profile's active state — "Active Profile" (is_active) vs
//      "Deleted Profile" (deactivated). Deactivating is the soft-delete: the
//      instructor is hidden from public + booking and never auto-assigned.
//   2. Only when no login is linked yet: "Must Sign Up" — they still need a
//      portal invite/sign-in. (A linked login means invited-or-active; we
//      don't yet distinguish "invited but never signed in".)
//
// Pure presentational (no hooks/state) so it renders in both the client
// roster component and the server-rendered profile page.

const badgeBase = "font-sans text-[12px] uppercase tracking-[0.5px]";

export function InstructorStatusBadges({
  isActive,
  hasPortalAccess,
  className,
}: {
  isActive: boolean;
  hasPortalAccess: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <span
        className={`${badgeBase} ${isActive ? "text-accent-success" : "text-accent-error"}`}
      >
        {isActive ? "Active Profile" : "Deleted Profile"}
      </span>
      {!hasPortalAccess && (
        <span className={`${badgeBase} text-accent-warn`}>Must Sign Up</span>
      )}
    </span>
  );
}
