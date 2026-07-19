import type { ReactNode } from "react";
import Link from "next/link";
import { PropertyImage } from "./property-image";
import { SectionHeading } from "./section-heading";

interface WayInTile {
  title?: string;
  linkHref?: string | null;
  imageUrl?: string | null;
}

interface WayInGridProps {
  eyebrow: ReactNode;
  heading?: ReactNode;
  tiles: ReadonlyArray<WayInTile>;
}

// "Find Your Way In" — the four-tile hover grid every property's homepage
// opens with, right after the intro. Heading copy is identical ("Find
// Your Way In") across all three today; only the eyebrow above it differs
// per property, so that's the one required prop — heading stays
// overridable rather than hardcoded in case a future property's mockup
// genuinely needs different words there.
export function WayInGrid({ eyebrow, heading = "Find Your Way In", tiles }: WayInGridProps) {
  return (
    <>
      <SectionHeading eyebrow={eyebrow} heading={heading} align="center" className="mb-12" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.linkHref ?? tile.title}
            href={tile.linkHref ?? "#"}
            className="group relative flex aspect-[4/5] items-end overflow-hidden border border-property-ink/10"
          >
            <PropertyImage
              src={tile.imageUrl ?? null}
              alt=""
              filename="wayin-tile.jpg"
              className="!absolute !inset-0 transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-property-scrim/90 via-property-scrim/45 to-transparent" />
            <div className="relative z-10 flex w-full flex-col items-center p-6 text-center">
              <h3 className="property-headline mb-2 font-property-display text-2xl uppercase text-white">
                {tile.title}
              </h3>
              <span className="flex items-center font-property-label text-property-label uppercase text-property-accent-dark transition-colors group-hover:text-property-surface-lowest">
                Explore
                <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
                  →
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
