import { Check } from "lucide-react";
import { PropertyImage } from "./property-image";

interface FacilityCardProps {
  title: string;
  blurb: string;
  items: ReadonlyArray<string>;
  imageSrc: string | null;
  imageFilename: string;
}

// One "Premier Amenities" tile — photo (or graceful placeholder) with a
// scrim gradient, heading/blurb/list overlaid at the bottom. Structure
// and min-height treatment transcribed 1:1 from the mockup's facility
// card markup (temporary-resources/front-end-beta/horseshoe-bay/index.html)
// so tile content lines up evenly across a row regardless of title/blurb
// length — a heading that wraps to two lines still bottom-aligns its
// baseline with a single-line neighbor.
export function FacilityCard({ title, blurb, items, imageSrc, imageFilename }: FacilityCardProps) {
  return (
    <div className="group relative flex aspect-[3/4] items-end overflow-hidden border border-property-ink/10">
      <PropertyImage
        src={imageSrc}
        alt=""
        filename={imageFilename}
        className="!absolute !inset-0 transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-property-scrim/95 via-property-scrim/75 to-property-scrim/40" />
      <div className="relative z-10 flex w-full flex-col items-center p-8 text-center">
        <h3 className="property-headline mb-2 flex min-h-[2.3em] items-end justify-center text-center font-property-display text-property-headline uppercase text-white">
          {title}
        </h3>
        <p className="mb-4 min-h-[4.2em] font-property-sans text-property-bg/80">{blurb}</p>
        <ul className="mt-1 w-full min-h-[8.5em] space-y-2 text-left">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2 font-property-sans text-sm text-property-bg/85">
              <Check className="mt-0.5 size-4 shrink-0 leading-tight text-property-camel" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
