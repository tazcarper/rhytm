import { PropertyImage } from "./property-image";

interface GalleryImage {
  src: string | null;
  filename: string;
  alt: string;
}

interface SplitGalleryProps {
  eyebrow: string;
  title: string;
  description: string;
  /** [main (8 cols), top-right (4 cols), bottom-right (4 cols)] */
  images: [GalleryImage, GalleryImage, GalleryImage];
}

// The dark-band photo gallery used on membership.html ("Club Spotlight")
// and private-events.html ("The Setting") — one large tile plus two
// stacked, no per-tile captions. Extracted once both pages needed the
// identical 8-col/4-col split so it doesn't drift between the two.
export function SplitGallery({ eyebrow, title, description, images }: SplitGalleryProps) {
  const [main, topRight, bottomRight] = images;
  return (
    <section className="w-full bg-property-ink py-property-section-mobile md:py-property-section-desktop">
      <div className="mx-auto max-w-property-max px-property-gutter">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 font-property-sans text-property-eyebrow uppercase tracking-[0.2em] text-property-accent-dark">
            {eyebrow}
          </p>
          <h2 className="property-display mb-4 font-property-display text-4xl uppercase leading-tight text-white md:text-6xl">
            {title}
          </h2>
          <p className="font-property-sans text-property-body-lg text-white/85">{description}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:h-[620px] md:grid-cols-12">
          <div className="relative aspect-[4/3] overflow-hidden md:col-span-8 md:aspect-auto md:h-full">
            <PropertyImage src={main.src} alt={main.alt} filename={main.filename} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:col-span-4 md:h-full md:grid-rows-2">
            <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:h-full">
              <PropertyImage src={topRight.src} alt={topRight.alt} filename={topRight.filename} />
            </div>
            <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:h-full">
              <PropertyImage src={bottomRight.src} alt={bottomRight.alt} filename={bottomRight.filename} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
