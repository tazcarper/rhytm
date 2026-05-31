import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicProperties } from "@/src/services/public/properties";
import { propertyOrdinal } from "@/src/constants/public/property-copy";
import { Alert, Button } from "@/lib/ui";
import s from "./home.module.css";

export const dynamic = "force-dynamic";

// Locale + sign-in href per property. Tagline now lives in the DB
// (properties.tagline, admin-editable at /admin/properties); locale
// is a stable geographic label kept in code.
const PROPERTY_COPY: Record<string, { locale: string; href: string }> = {
  "horseshoe-bay": { locale: "Texas Hill Country", href: "/login" },
  "hog-heaven": { locale: "Driftwood, Texas", href: "/login" },
  "packsaddle": { locale: "Llano County", href: "/login" },
};

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: properties, error } = await getPublicProperties(supabase);

  return (
    <main>
      {/* ───── Hero ───────────────────────────────────────────────── */}
      <section className={s.hero}>
        <div className={s.heroInner}>
          <span className={s.heroEstablished}>Est. 2026</span>
          <h1 className={s.heroTitle}>
            Your day in the <br/><em>Texas Hill Country</em> starts here.
          </h1>
          <p className={s.heroLead}>
            Sporting clays, private instruction, and unforgettable
            gatherings across three storied properties — reserved
            online in minutes.
          </p>
          <div className={s.heroActions}>
            <Button asChild variant="primary" size="lg">
              <Link href="/book">Plan your visit</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/login">Members&rsquo; Entrance</Link>
            </Button>
          </div>
          {/* <div className={s.heroMeta}>
            <div>
              <strong>Horseshoe Bay</strong>
              Hill Country
            </div>
            <div>
              <strong>Hog Heaven</strong>
              Driftwood
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

      {/* ───── Properties ────────────────────────────────────────── */}
      <section id="properties" className={s.section}>
        <header className={s.sectionHead}>
          <div className={s.heroEstablished}>The Properties</div>
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
            Different experiences. <em style={{ fontStyle: "italic", color: "var(--tan-deep)", fontWeight: 500 }}>Same standards.</em>
          </h2>
          <p className={s.sectionDeck}>
            Each property has its own character and setting — and every
            one delivers the same warm welcome and effortless booking.
          </p>
        </header>

        {error && (
          <div className={s.propertyError}>
            <Alert variant="error" title="Could not load properties">
              {error.message}
            </Alert>
          </div>
        )}

        {properties && properties.length > 0 && (
          <div className={s.propertyGrid}>
            {properties.map((p, i) => {
              const copy = PROPERTY_COPY[p.slug] ?? {
                locale: "—",
                href: "/login",
              };
              return (
                <Link
                  key={p.id}
                  href={copy.href}
                  className={s.propertyCard}
                >
                  <div className={s.propertyOrdinal}>No. {propertyOrdinal(i)}</div>
                  <h3 className={s.propertyName}>{p.name}</h3>
                  <p className={s.propertyLocale}>{copy.locale}</p>
                  <div className={s.propertyRule} />
                  {p.tagline && (
                    <p className={s.propertyTagline}>{p.tagline}</p>
                  )}
                  <span className={s.propertyCta}>Members&rsquo; Entrance &rarr;</span>
                </Link>
              );
            })}
          </div>
        )}

        {properties && properties.length === 0 && (
          <Alert variant="warn" title="No properties found">
            Check Phase 1 seed data — the umbrella site has nothing to
            show without at least one row in <code>public.properties</code>.
          </Alert>
        )}
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

