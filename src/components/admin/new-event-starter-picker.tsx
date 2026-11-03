import Link from "next/link";
import { Card } from "@/lib/ui";
import type { EventStarter, EventStarterKey } from "@/src/constants/admin/event-starters";

// The quick path for most events: pick a starter and the new draft gets its
// sensible defaults (kind, spots, tickets, gear), then the admin edits the
// details in the section builder. Plain
// links (?starter=…) so the choice survives a refresh and needs no client JS.
export function NewEventStarterPicker({
  starters,
  activeKey,
}: {
  starters: ReadonlyArray<EventStarter>;
  activeKey: EventStarterKey | null;
}) {
  return (
    <Card padding="default" elevation="soft" className="mb-6">
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-label text-tan-deep">Start from</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {starters.map((starter) => {
          const isActive = starter.key === activeKey;
          return (
            <Link
              key={starter.key}
              href={`/admin/events/new?starter=${starter.key}`}
              aria-current={isActive ? "true" : undefined}
              className={`rounded-sharp border p-3 transition-colors ${
                isActive ? "border-olive bg-paper" : "border-rule hover:border-olive"
              }`}
            >
              <span className="block text-[15px] font-semibold text-olive">{starter.label}</span>
              <span className="mt-1 block text-[13px] text-gray">{starter.blurb}</span>
            </Link>
          );
        })}
      </div>
      {activeKey && (
        <p className="mt-3 text-micro text-gray">
          Its tickets, spots and gear are added for you. You can change any of it next.{" "}
          <Link href="/admin/events/new" className="underline">
            Clear
          </Link>
        </p>
      )}
    </Card>
  );
}
