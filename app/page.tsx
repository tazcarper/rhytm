import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicAdventures } from "@/src/services/public/adventures";
import { getHomepageHero } from "@/src/services/public/homepage-hero";
import { AdventureTile } from "@/src/components/public/adventure-tile";
import { Alert, Button } from "@/lib/ui";
import s from "./home.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const [{ data: adventures, error }, hero] = await Promise.all([
    getPublicAdventures(supabase),
    getHomepageHero(supabase),
  ]);

  // An optional background image layers over the existing gradient.
  const heroStyle = hero.imageUrl
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${hero.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <main>
      {/* ───── Hero (editable from /admin/homepage) ──────────────── */}
      <section className={s.hero} style={heroStyle}>
        <div className={s.heroInner}>
          {hero.eyebrow && (
            <span className={s.heroEstablished}>{hero.eyebrow}</span>
          )}
          <h1 className={s.heroTitle}>{hero.title}</h1>
          {hero.lead && <p className={s.heroLead}>{hero.lead}</p>}
          <div className={s.heroActions}>
            {hero.primaryCtaLabel && hero.primaryCtaHref && (
              <Button asChild variant="primary" size="lg">
                <Link href={hero.primaryCtaHref}>{hero.primaryCtaLabel}</Link>
              </Button>
            )}
            {hero.secondaryCtaLabel && hero.secondaryCtaHref && (
              <Button asChild variant="secondary" size="lg">
                <Link href={hero.secondaryCtaHref}>
                  {hero.secondaryCtaLabel}
                </Link>
              </Button>
            )}
          </div>
          {/* <div className={s.heroMeta}>
            <div>
              <strong>Horseshoe Bay</strong>
              Hill Country
            </div>
            <div>
              <strong>Hog Heaven</strong>
              Dripping Springs
            </div>
            <div>
              <strong>Packsaddle</strong>
              Llano County
            </div>
          </div> */}
        </div>
      </section>

      {/* ───── Manifesto pullquote ───────────────────────────────── */}
      <section className={s.manifesto}>
        <div className={s.manifestoInner}>
          <div className={s.manifestoMark}>Why Rhythm</div>
          <p className={s.manifestoQuote}>
            A great day outside should be easy to say yes to.{" "}
            <strong>So we made it simple.</strong> Choose your property,
            pick your experience, and we&rsquo;ll have everything ready
            when you arrive.
          </p>
          <div className={s.manifestoAttr}>Rhythm Outdoors</div>
        </div>
      </section>

      {/* ───── Adventures (full-bleed, feature-led) ──────────────── */}
      <section id="adventures" className={s.adventureBand}>
        <div className={s.adventureInner}>
          <header className={s.sectionHead}>
            <div className={s.heroEstablished}>Member Adventures</div>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontSize: "clamp(36px, 6vw, 56px)",
                fontWeight: 600,
                color: "var(--olive)",
                letterSpacing: "-1px",
                margin: 0,
                lineHeight: 1.02,
              }}
            >
              Where we&rsquo;re <em style={{ fontStyle: "italic", color: "var(--tan-deep)", fontWeight: 500 }}>going next.</em>
            </h2>
            <p className={s.sectionDeck}>
              Curated journeys and signature experiences — a members&rsquo;
              privilege. Open to view; reserved by members of the Club.
            </p>
          </header>

          {error && (
            <Alert variant="error" title="Could not load adventures">
              {error.message}
            </Alert>
          )}

          {adventures && adventures.length > 0 && (
            <>
              <div className={s.adventureCollection}>
                <AdventureTile adventure={adventures[0]} feature index={0} />
                {adventures.length > 1 && (
                  <div className={s.adventureRow}>
                    {adventures.slice(1, 3).map((adventure, i) => (
                      <AdventureTile key={adventure.id} adventure={adventure} index={i + 1} />
                    ))}
                  </div>
                )}
              </div>
              <div className={s.sectionCta}>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/adventures">View all adventures &rarr;</Link>
                </Button>
              </div>
            </>
          )}

          {adventures && adventures.length === 0 && (
            <Alert variant="info" title="No adventures open right now">
              Curated trips for the membership are listed here as they&rsquo;re
              scheduled. Check back soon.
            </Alert>
          )}
        </div>
      </section>

      {/* ───── How it works ──────────────────────────────────────── */}
      <section className={s.howSection}>
        <div className={s.howInner}>
          <header className={s.sectionHead}>
            <div className={s.heroEstablished}>How It Works</div>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontSize: "clamp(32px, 5vw, 44px)",
                fontWeight: 600,
                color: "var(--olive)",
                letterSpacing: "-0.5px",
                margin: 0,
              }}
            >
              From first idea to a day on the calendar — <em style={{ fontStyle: "italic", color: "var(--tan-deep)", fontWeight: 500 }}>in minutes.</em>
            </h2>
            <p className={s.sectionDeck}>
              No phone tag, no waiting on a callback. Reserve your
              experience whenever inspiration strikes.
            </p>
          </header>

          <div className={s.howCard}>
            <p className={s.howCardTitle}>
              A few simple steps &middot; clear pricing &middot; confirmed
              the moment you&rsquo;re done.
            </p>
            <div className={s.howSteps}>
              <Step num="01" label="Choose your property" desc="Three Hill Country settings, each with its own character" />
              <Step num="02" label="Pick your experience" desc="Sporting clays, a private lesson, or a hosted occasion" />
              <Step num="03" label="Set the details" desc="Guests, date, and time — priced for you instantly" />
              <Step num="04" label="Review your bid" desc="Everything laid out clearly, ready to sign" />
              <Step num="05" label="Confirm your spot" desc="Place your deposit and you&rsquo;re booked" />
            </div>
          </div>
        </div>
      </section>

      {/* ───── Final CTA ─────────────────────────────────────────── */}
      <section className={s.finalCta}>
        <div className={s.finalCtaInner}>
          <span className={s.finalCtaEyebrow}>Ready when you are</span>
          <h2 className={s.finalCtaTitle}>
            Come spend a day <em>with us.</em>
          </h2>
          <p className={s.finalCtaDeck}>
            New here? Start by planning your visit. Already a member?
            Sign in to manage your bookings and household.
          </p>
          <div className={s.finalCtaActions}>
            <Button asChild variant="secondary" size="lg">
              <Link href="/book">Plan your visit</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/login">Members&rsquo; Entrance</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ───── Footer ────────────────────────────────────────────── */}
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <div className={s.footerMark}>Rhythm Outdoors</div>
          <div className={s.footerCopy}>
            &copy; {new Date().getFullYear()} &middot; All rights reserved
          </div>
        </div>
      </footer>
    </main>
  );
}

function Step({
  num,
  label,
  desc,
}: {
  num: string;
  label: string;
  desc: string;
}) {
  return (
    <div className={s.howStep}>
      <span className={s.howStepNum}>{num}</span>
      <span className={s.howStepLabel}>{label}</span>
      <p className={s.howStepDesc}>{desc}</p>
    </div>
  );
}

