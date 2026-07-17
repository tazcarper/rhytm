import { Check } from "lucide-react";
import type { PublicEventInfoBox } from "@/src/services/public/events";

// Renders one admin-authored event_info_boxes row — a prose block or a
// bullet list, matching the "What to expect" / "Required gear" style
// content in the event-detail mockup.
export function InfoBoxRenderer({ box }: { box: PublicEventInfoBox }) {
  return (
    <div className="border border-property-ink/10 p-6">
      <h3 className="font-property-sans text-property-label uppercase tracking-[0.15em] text-property-accent-dark mb-3">
        {box.heading}
      </h3>
      {box.boxType === "description" ? (
        <p className="font-property-sans text-property-body text-property-ink-variant whitespace-pre-wrap m-0">
          {box.body}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(box.items ?? []).map((item) => (
            <li key={item} className="flex items-start gap-2 font-property-sans text-property-body text-property-ink-variant">
              <Check className="mt-1 size-4 shrink-0 text-property-camel" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
