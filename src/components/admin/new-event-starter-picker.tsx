import Link from "next/link";
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
    <div className="mb-5">
      <p className="mb-2 text-[13px] text-gray">
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
      <div className="flex flex-wrap gap-2">
        {starters.map((starter) => {
          const isActive = starter.key === activeKey;
          return (
            <Link
              key={starter.key}
              href={`/admin/events/new?starter=${starter.key}`}
              aria-current={isActive ? "true" : undefined}
              title={starter.blurb}
              className={`rounded-sharp border px-3 py-1.5 text-[14px] transition-colors ${
                isActive ? "border-olive bg-paper font-semibold text-olive" : "border-rule text-olive hover:border-olive"
              }`}
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
