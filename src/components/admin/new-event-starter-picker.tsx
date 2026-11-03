import Link from "next/link";
import f from "./event-flow.module.css";
import type { EventStarter, EventStarterKey } from "@/src/constants/admin/event-starters";

// Optional quick start inside the "Fill it in myself" card: pick a starter
// and the new draft gets its sensible defaults (kind, spots, tickets, gear).
// Plain links (?starter=…) so the choice survives a refresh and needs no
// client JS.
export function NewEventStarterPicker({
  starters,
  activeKey,
}: {
  starters: ReadonlyArray<EventStarter>;
  activeKey: EventStarterKey | null;
}) {
  return (
    <div className="mb-8">
      <p className="mb-3 text-[17px] text-[#4a5650]">
        Optional: pick a starter to fill in typical spots, tickets and gear.
        {activeKey && (
          <>
            {" "}
            <Link href="/admin/events/new?how=manual" className="underline">
              Clear
            </Link>
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        {starters.map((starter) => {
          const isActive = starter.key === activeKey;
          return (
            <Link
              key={starter.key}
              href={`/admin/events/new?starter=${starter.key}`}
              aria-current={isActive ? "true" : undefined}
              title={starter.blurb}
              className={`${f.chip} ${isActive ? f.chipActive : ""}`}
            >
              {isActive ? "✓ " : ""}
              {starter.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
