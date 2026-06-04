import Link from "next/link";
import type { PublicAdventure } from "@/src/services/public/adventures";
import type { AdventureSection } from "@/src/services/adventures/display";
import {
  adventureDateLabel,
  adventurePriceLabel,
} from "@/src/services/adventures/display";
import { AdventureAttributes } from "./adventure-attributes";
import { ReserveBar, type ReserveState } from "./reserve-bar";
import s from "./adventure-detail-view.module.css";

export type { ReserveState };

// Public adventure detail page — an immersive, chaptered editorial in the
// spirit of Matador's series features: full-screen hero, an at-a-glance
// strip (type-of-stay icons + facts), a narrative lead, alternating
// image/text chapters, a large gallery, and a sticky members-only reserve
// bar pinned to the bottom (see ReserveBar).
export function AdventureDetailView({
  adventure,
  reserve,
}: {
  adventure: PublicAdventure;
  reserve: ReserveState;
}) {
  const dateLabel = adventureDateLabel(adventure);
  const priceLabel = adventurePriceLabel({
    price: adventure.pricing.price,
    guestPrice: adventure.pricing.guestPrice,
    priceLabel: adventure.priceLabel,
  });

  return (
    <article className={s.page}>
      {/* ── Full-screen hero ─────────────────────────────────── */}
      <header
        className={s.hero}
        style={
          adventure.heroImage
            ? { backgroundImage: `url(${adventure.heroImage})` }
            : undefined
        }
      >
        <Link href="/adventures" className={s.back}>
          &larr; All adventures
        </Link>
        <div className={s.heroScrim}>
          <div className={s.heroInner}>
            <span className={s.membersTag}>Members only</span>
            <h1 className={s.title}>{adventure.title}</h1>
            {adventure.location && <p className={s.location}>{adventure.location}</p>}
          </div>
        </div>
      </header>

      {/* ── At a glance: type-of-stay icons + facts ──────────── */}
      <section className={s.glance}>
        <div className={s.glanceInner}>
          {adventure.attributes.length > 0 && (
            <AdventureAttributes keys={adventure.attributes} />
          )}
          <dl className={s.facts}>
            <Fact label="When" value={dateLabel} />
            {adventure.durationLabel && <Fact label="Duration" value={adventure.durationLabel} />}
            <Fact label="Hosted by" value={adventure.propertyName} />
            <Fact label="Member price" value={priceLabel} />
          </dl>
        </div>
      </section>

      {/* ── Overview ───────────────────────────────────────────── */}
      {adventure.description && (
        <section className={s.overview}>
          <div className={s.overviewMark}>The Experience</div>
          <p className={s.lead}>{adventure.description}</p>
        </section>
      )}

      {/* ── Highlights ──────────────────────────────────────────── */}
      {adventure.highlights.length > 0 && (
        <section className={s.highlights}>
          <div className={s.highlightsMark}>What&rsquo;s included</div>
          <ul className={s.highlightsList}>
            {adventure.highlights.map((item, i) => (
              <li key={i} className={s.highlightItem}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Chapters (alternating image / narrative) ────────────── */}
      {adventure.sections.map((section, i) => (
        <Chapter key={i} section={section} index={i} reversed={i % 2 === 1} />
      ))}

      {/* ── Gallery ─────────────────────────────────────────────── */}
      {adventure.gallery.length > 0 && (
        <section className={s.gallery}>
          {adventure.gallery.map((src, i) => (
            // Placeholder stock imagery; plain <img> by design.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              className={i % 3 === 0 ? s.galleryImgWide : s.galleryImg}
              src={src}
              alt=""
              loading="lazy"
            />
          ))}
        </section>
      )}

      {/* ── Sticky reserve bar (members-only gate) ──────────────── */}
      <ReserveBar adventure={adventure} reserve={reserve} />
    </article>
  );
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function Chapter({
  section,
  index,
  reversed,
}: {
  section: AdventureSection;
  index: number;
  reversed: boolean;
}) {
  return (
    <section className={`${s.chapter} ${reversed ? s.chapterReversed : ""}`}>
      <div className={s.chapterText}>
        <div className={s.chapterMark}>{ROMAN[index] ?? index + 1}</div>
        <h2 className={s.chapterHeading}>{section.heading}</h2>
        <p className={s.chapterBody}>{section.body}</p>
      </div>
      {section.image && (
        <div className={s.chapterMedia}>
          {/* Placeholder stock imagery; plain <img> by design. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.chapterImg} src={section.image} alt="" loading="lazy" />
        </div>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.fact}>
      <dt className={s.factLabel}>{label}</dt>
      <dd className={s.factValue}>{value}</dd>
    </div>
  );
}
