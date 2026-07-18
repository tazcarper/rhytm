import { PropertyImage } from "./property-image";

interface OccasionCardProps {
  title: string;
  blurb: string;
  imageSrc: string | null;
  imageFilename: string;
}

// Image-on-top card for "Events We Host" style grids — distinct from
// FacilityCard's dark-scrim-overlay treatment: photo above, solid
// surface-container panel with the copy below.
export function OccasionCard({ title, blurb, imageSrc, imageFilename }: OccasionCardProps) {
  return (
    <div className="flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden">
        <PropertyImage src={imageSrc} alt="" filename={imageFilename} />
      </div>
      <div className="flex-grow bg-property-surface p-8 text-center">
        <h3 className="property-headline mb-3 font-property-display text-xl uppercase text-property-ink">
          {title}
        </h3>
        <p className="font-property-sans text-property-ink-variant">{blurb}</p>
      </div>
    </div>
  );
}
