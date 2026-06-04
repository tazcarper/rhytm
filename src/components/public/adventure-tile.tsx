import Link from "next/link";
import { Badge } from "@/lib/ui";
import { AdventureImage } from "./adventure-image";
import type { PublicAdventure } from "@/src/services/public/adventures";
import {
  adventureBadge,
  adventureDateLabel,
  adventurePriceLabel,
  stripMarkdown,
} from "@/src/services/adventures/display";
import s from "./adventure-tile.module.css";

// Image-forward adventure tile for the /adventures browse page. The whole
// tile is the photograph; text sits over a gradient scrim at the bottom.
// `feature` makes it a wide marquee (the lead adventure). The card is one
// big link that invites investigation — hover zooms the image and brings
// the "Explore" cue forward.
export function AdventureTile({
  adventure,
  feature = false,
  index = 0,
}: {
  adventure: PublicAdventure;
  feature?: boolean;
  index?: number;
}) {
  const badge = adventureBadge(adventure);
  const dateLabel = adventureDateLabel(adventure);
  const priceLabel = adventurePriceLabel({
    price: adventure.pricing.price,
    guestPrice: adventure.pricing.guestPrice,
    priceLabel: adventure.priceLabel,
  });
  const eyebrow = [adventure.category, adventure.location]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Link
      href={`/adventures/${adventure.id}`}
      className={`${s.tile} ${feature ? s.feature : ""}`}
      style={{ animationDelay: `${0.08 * index}s` }}
    >
      <div className={s.media}>
        {adventure.heroImage ? (
          <AdventureImage
            className={s.img}
            src={adventure.heroImage}
            alt=""
            priority={feature}
            sizes={feature ? "100vw" : "(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 33vw"}
          />
        ) : (
          <div className={s.imgFallback} aria-hidden />
        )}
      </div>
      <div className={s.scrim} aria-hidden />

      <div className={s.top}>
        <Badge variant={badge.variant}>{badge.text}</Badge>
        <span className={s.members}>Members only</span>
      </div>

      <div className={s.content}>
        {eyebrow && <div className={s.eyebrow}>{eyebrow}</div>}
        <h3 className={s.title}>{adventure.title}</h3>
        {feature && adventure.description && (
          <p className={s.blurb}>{stripMarkdown(adventure.description)}</p>
        )}
        <div className={s.foot}>
          <span className={s.meta}>
            {dateLabel}
            <span className={s.dot}>·</span>
            {priceLabel}
          </span>
          <span className={s.explore}>
            Explore <span className={s.arrow}>&rarr;</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
