import { EyeOff } from "lucide-react";
import type { StaffOnlyEventStatus } from "@/src/services/public/events";

// Marks an event only staff can see. Admins browse the public site with
// their broader access, so draft (and cancelled/completed) events show up
// for them alongside live ones; this makes the difference unmissable.
// Deliberately loud and off-brand (amber, not the property palette): it is
// a staff warning, never seen by guests.

const LABEL: Record<StaffOnlyEventStatus, string> = {
  draft: "Draft",
  cancelled: "Cancelled",
  completed: "Finished",
};

export function staffOnlyLabel(status: StaffOnlyEventStatus): string {
  return `${LABEL[status]} · only staff can see this`;
}

/** Badge to lay over an event card or image. */
export function StaffOnlyBadge({ status, className = "" }: { status: StaffOnlyEventStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#f5c518] px-3 py-1 font-sans text-[13px] font-bold normal-case tracking-normal text-[#1a1a1a] shadow-md ${className}`}
    >
      <EyeOff aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
      {staffOnlyLabel(status)}
    </span>
  );
}

/** Outline for the card/row of a staff-only event. */
export const STAFF_ONLY_OUTLINE = "outline outline-[3px] outline-dashed outline-[#f5c518] outline-offset-4";

/** Full-width notice at the top of a staff-only event's page. */
export function StaffOnlyBanner({ status, editHref }: { status: StaffOnlyEventStatus; editHref: string }) {
  const why =
    status === "draft"
      ? "Guests can't see this event or sign up until it's published."
      : "Guests can't see this event.";
  return (
    <div role="status" className="bg-[#f5c518] px-6 py-3 text-[#1a1a1a]">
      <div className="mx-auto flex max-w-property-max flex-wrap items-center justify-between gap-x-6 gap-y-2 font-sans text-[15px]">
        <p className="m-0 flex items-center gap-2">
          <EyeOff aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          <strong>{staffOnlyLabel(status)}.</strong> {why}
        </p>
        <a href={editHref} className="font-bold text-[#1a1a1a] underline underline-offset-2 hover:text-[#1a1a1a]">
          Edit in the dashboard
        </a>
      </div>
    </div>
  );
}
