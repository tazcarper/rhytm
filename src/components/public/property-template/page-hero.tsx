import { PropertyImage } from "./property-image";

interface PageHeroProps {
  title: string;
  imageSrc: string | null;
  imageFilename: string;
}

// The interior-page hero band used by membership/education/private-events/
// events/faq — a photo with a scrim gradient and a centered uppercase
// title, 560px tall. Matches the mockups' `.scrim-hero` treatment
// (linear-gradient rgba(scrim, 0.45) to rgba(scrim, 0.80)) exactly, ported
// to the property-scrim token so it tracks per-property color.
export function PageHero({ title, imageSrc, imageFilename }: PageHeroProps) {
  return (
    <header className="relative flex h-[560px] w-full items-center justify-center overflow-hidden">
      <PropertyImage src={imageSrc} alt="" filename={imageFilename} className="!absolute !inset-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-property-scrim/45 to-property-scrim/80" />
      <div className="relative z-10 mx-auto max-w-4xl px-property-gutter text-center">
        <h1 className="property-display font-property-display text-property-display-mobile uppercase leading-tight text-white md:text-property-display">
          {title}
        </h1>
      </div>
    </header>
  );
}
