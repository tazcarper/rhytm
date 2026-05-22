import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicProperties } from "@/src/services/public/properties";
import { propertyOrdinal } from "@/src/constants/public/property-copy";
import { Alert, Button } from "@/lib/ui";
import s from "./home.module.css";

export const dynamic = "force-dynamic";

// Umbrella-landing tagline + sign-in href per property. Editorial
// voice is distinct from the booking-funnel copy in
// src/constants/public/property-copy.ts — keep them separate.
const PROPERTY_COPY: Record<
  string,
  { locale: string; tagline: string; href: string }
> = {
  "horseshoe-bay": {
    locale: "Texas Hill Country",
    tagline:
      "A members-only sporting club on the lake — clays, helice, instruction, and the quiet kind of hospitality.",
    href: "/login",
  },
  "hog-heaven": {
    locale: "Driftwood, Texas",
    tagline:
      "Wing-shooting and wedding weekends on six hundred acres, paired with Camp Lucy when the occasion asks for it.",
    href: "/login",
  },
  "packsaddle": {
    locale: "Llano County",
    tagline:
      "Precision rifle, suppressed and unhurried — coaching for marksmen who want range time without a crowd.",
    href: "/login",
  },
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
            Three properties. <em>One way</em> to book them.
          </h1>
          <p className={s.heroLead}>
            We connect people to themselves, to each other, and to the
            natural world — without making them call to do it.
          </p>
          <div className={s.heroActions}>
            <Button asChild variant="primary" size="lg">
              <Link href="/login">Members&rsquo; Entrance</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/book">Book an experience</Link>
            </Button>
          </div>
          <div className={s.heroMeta}>
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
          </div>
        </div>
      </section>

      {/* ───── Manifesto pullquote ───────────────────────────────── */}
      <section className={s.manifesto}>
        <div className={s.manifestoInner}>
          <div className={s.manifestoMark}>The Operating Principle</div>
          <p className={s.manifestoQuote}>
            Outdoor experiences are not hard. <strong>Booking them is.</strong>{" "}
            We built one back-of-house so the front-of-house can just be
            present.
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
            Different country. <em style={{ fontStyle: "italic", color: "var(--tan-deep)", fontWeight: 500 }}>Same standard.</em>
          </h2>
          <p className={s.sectionDeck}>
            Each property keeps its own character — and shares the same
            concierge, the same bid, the same deposit flow.
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
                tagline: "",
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
                  <p className={s.propertyTagline}>{copy.tagline}</p>
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
            <div className={s.heroEstablished}>The Promise</div>
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
              From interest to confirmed booking — <em style={{ fontStyle: "italic", color: "var(--tan-deep)", fontWeight: 500 }}>in five clicks.</em>
            </h2>
            <p className={s.sectionDeck}>
              The shape of every reservation, regardless of property or
              experience type.
            </p>
          </header>

          <div className={s.howCard}>
            <p className={s.howCardTitle}>
              Five stages &middot; fifteen clicks or fewer &middot; one
              signed bid at the end.
            </p>
            <div className={s.howSteps}>
              <Step num="01" label="Land" desc="Public site, member portal, or partner link" />
              <Step num="02" label="Choose" desc="Property, experience, audience tier" />
              <Step num="03" label="Configure" desc="Guests, date, time — priced live" />
              <Step num="04" label="Sign" desc="Digital signature on a branded bid" />
              <Step num="05" label="Pay" desc="Deposit + waiver, embedded" />
            </div>
          </div>
        </div>
      </section>

      {/* ───── Final CTA ─────────────────────────────────────────── */}
      <section className={s.finalCta}>
        <div className={s.finalCtaInner}>
          <span className={s.finalCtaEyebrow}>Two ways in</span>
          <h2 className={s.finalCtaTitle}>
            Already a member, <em>or thinking about it?</em>
          </h2>
          <p className={s.finalCtaDeck}>
            Members sign in to manage their bookings and household.
            Everyone else starts at a property and talks to the concierge.
          </p>
          <div className={s.finalCtaActions}>
            <Button asChild variant="secondary" size="lg">
              <Link href="/login">Members&rsquo; Entrance</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="#properties">Explore properties</Link>
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

