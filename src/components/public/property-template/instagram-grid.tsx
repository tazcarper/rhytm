import type { ReactNode } from "react";
import { PropertyImage } from "./property-image";
import { PropertyButton } from "./property-button";
import { SectionHeading } from "./section-heading";

interface InstagramPhoto {
  imageUrl?: string | null;
  linkHref?: string | null;
}

interface InstagramGridProps {
  eyebrow: ReactNode;
  heading: ReactNode;
  ctaLabel: ReactNode;
  ctaHref: string;
  photos: ReadonlyArray<InstagramPhoto>;
  /** Horseshoe Bay's mockup uses 4:5 tiles; Hog Heaven's and Packsaddle's
      use square. Default "square" — pass "portrait" to match Horseshoe
      Bay. */
  aspect?: "square" | "portrait";
}

// The Club Life "Follow Along" Instagram section — heading row with a
// "Follow Us" link, then a responsive photo grid where each tile either
// links out (real photo/handle) or renders plain (no link yet). All copy
// (eyebrow/heading/CTA) stays data passed in from the page, same as every
// other CMS-backed section — nothing hardcoded here, just the mechanical
// grid/link markup that was previously byte-identical across all three
// properties' club-life pages.
export function InstagramGrid({ eyebrow, heading, ctaLabel, ctaHref, photos, aspect = "square" }: InstagramGridProps) {
  const aspectClass = aspect === "portrait" ? "aspect-[4/5]" : "aspect-square";

  return (
    <>
      <div className="mb-8 flex items-end justify-between">
        <SectionHeading eyebrow={eyebrow} heading={heading} />
        <PropertyButton href={ctaHref} variant="ghost" target="_blank" rel="noopener noreferrer">
          {ctaLabel}
        </PropertyButton>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {photos.map((photo, index) => {
          const content = (
            <div className={`relative overflow-hidden ${aspectClass}`}>
              <PropertyImage src={photo.imageUrl ?? null} alt="" filename="ig-photo.jpg" />
            </div>
          );
          return photo.linkHref ? (
            <a
              key={photo.linkHref + index}
              href={photo.linkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              {content}
            </a>
          ) : (
            <div key={index}>{content}</div>
          );
        })}
      </div>
    </>
  );
}
