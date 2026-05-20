import Link from "next/link";
import s from "./property-card.module.css";

export interface PropertyCardProps {
  ordinal: string;
  name: string;
  href: string;
  locale: string;
  tagline: string;
  ctaLabel?: string;
}

export function PropertyCard({
  ordinal,
  name,
  href,
  locale,
  tagline,
  ctaLabel = "Start booking →",
}: PropertyCardProps) {
  return (
    <Link href={href} className={s.card}>
      <div className={s.ordinal}>No. {ordinal}</div>
      <h3 className={s.name}>{name}</h3>
      <p className={s.locale}>{locale}</p>
      <div className={s.rule} />
      <p className={s.tagline}>{tagline}</p>
      <span className={s.cta}>{ctaLabel}</span>
    </Link>
  );
}
