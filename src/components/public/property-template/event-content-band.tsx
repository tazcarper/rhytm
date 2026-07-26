import type { ReactNode } from "react";

// One full-width heading|content row on the event detail page — "About
// This Event" and every admin-authored info box ("What to Expect",
// "Required Gear", …) share this exact treatment, stacked vertically with
// a hairline divider between each, matching the reference mockup's own
// `band()` helper (which renders all three with identical markup).
export function EventContentBand({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-14 border-t border-property-ink/10 pt-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <h2 className="property-display font-property-display text-3xl uppercase leading-tight text-property-ink md:text-4xl lg:col-span-5">
          {heading}
        </h2>
        <div className="lg:col-span-7">{children}</div>
      </div>
    </section>
  );
}
