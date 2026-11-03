import { Card } from "@/lib/ui";
import type { CapabilityRequestRow } from "@/src/services/ai/capability-requests";

// Read-only list of the feature requests the AI helper collected. In the
// pilot, success means these stay rare; a pile-up means the developer
// should ask the business what's missing and make it a default or starter.
export function CapabilityRequestsList({ rows }: { rows: ReadonlyArray<CapabilityRequestRow> }) {
  if (rows.length === 0) {
    return (
      <Card padding="default" elevation="soft">
        <p className="text-[14px] text-gray">
          No feature requests yet. When the helper can&apos;t express something staff ask for, it shows up here.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <Card key={row.id} padding="default" elevation="soft">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[15px] font-semibold text-olive">{row.summary}</p>
            <span className="text-micro uppercase tracking-label text-gray">{row.status}</span>
          </div>
          <p className="mt-1 text-[14px] text-gray">&ldquo;{row.ownerWords}&rdquo;</p>
          <p className="mt-2 text-micro text-gray">
            {row.propertyName ?? "No property"} ·{" "}
            {new Date(row.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "America/Chicago",
            })}
          </p>
        </Card>
      ))}
    </div>
  );
}
