import Link from "next/link";
import type { PropertyProfile } from "@/src/constants/public/property-profiles";
import { NewsletterForm } from "./newsletter-form";

interface PropertyFooterProps {
  profile: PropertyProfile;
}

const LABEL_CLASS = "font-property-label text-property-label uppercase tracking-[0.2em] text-property-accent-dark mb-2";
const LINE_CLASS = "text-property-surface-low/80 font-property-sans text-property-body leading-relaxed";

// Shared footer — newsletter band, four-column info grid, sibling-club
// cross-links, copyright bar. Identical structure across every property;
// only the profile's content differs.
export function PropertyFooter({ profile }: PropertyFooterProps) {
  return (
    <footer className="mt-auto w-full bg-property-ink text-property-surface-low">
      <div className="border-b border-property-surface-low/10">
        <div className="mx-auto flex max-w-property-max flex-col gap-6 px-property-section-mobile py-10 md:flex-row md:items-center md:justify-center md:gap-12 md:px-property-gutter">
          <div className="md:max-w-md">
            <h4 className={LABEL_CLASS}>{profile.newsletterHeading}</h4>
            <p className="font-property-sans text-property-body text-property-surface-low/80">
              {profile.newsletterBlurb}
            </p>
          </div>
          <NewsletterForm propertySlug={profile.slug} />
        </div>
      </div>

      <div className="mx-auto grid max-w-property-max grid-cols-1 gap-property-gutter px-property-section-mobile py-property-section-desktop md:grid-cols-4 md:px-property-gutter">
        <div className="col-span-1 flex items-start justify-center md:justify-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.footerLogoSrc} alt={profile.name} className="h-40 w-auto object-contain" />
        </div>

        <div className="col-span-1 space-y-6">
          <div>
            <h4 className={LABEL_CLASS}>Location</h4>
            <p className={LINE_CLASS}>
              {profile.addressLines.map((line, index) => (
                <span key={line}>
                  {line}
                  {index < profile.addressLines.length - 1 && <br />}
                </span>
              ))}
            </p>
          </div>
          <div>
            <h4 className={LABEL_CLASS}>Contact</h4>
            <p className={LINE_CLASS}>
              <a href={`mailto:${profile.email}`} className="hover:text-property-surface-lowest transition-colors">
                {profile.email}
              </a>
            </p>
            <p className={LINE_CLASS}>
              <a href={`tel:${profile.phoneHref}`} className="hover:text-property-surface-lowest transition-colors">
                {profile.phone}
              </a>
            </p>
          </div>
          <div>
            <h4 className={LABEL_CLASS}>Club Office Hours</h4>
            {profile.officeHours.map((row) => (
              <p key={row.label} className={LINE_CLASS}>
                {row.label}: {row.hours}
              </p>
            ))}
          </div>
        </div>

        <div className="col-span-1 flex flex-col space-y-4">
          <h4 className={LABEL_CLASS}>Explore</h4>
          <Link href={`/${profile.slug}`} className={`${LINE_CLASS} hover:text-property-surface-lowest transition-colors`}>
            Home
          </Link>
          {profile.navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={`${LINE_CLASS} hover:text-property-surface-lowest transition-colors`}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="col-span-1 flex flex-col space-y-4">
          <h4 className={LABEL_CLASS}>Connect</h4>
          {profile.socialLinks.map((social) => (
            <a
              key={social.href}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${LINE_CLASS} hover:text-property-surface-lowest transition-colors`}
            >
              {social.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-property-max flex-wrap items-center justify-center gap-x-3 gap-y-1 px-property-section-mobile py-4 text-center font-property-label text-[11px] uppercase tracking-widest text-property-surface-low/50 md:px-property-gutter">
        <span>
          {profile.name} is a{" "}
          <a href="/" className="underline underline-offset-2 hover:text-property-surface-lowest transition-colors">
            Rhythm Outdoors
          </a>{" "}
          club.
        </span>
        {profile.siblingProperties.map((sibling) => (
          <span key={sibling.href} className="flex items-center gap-x-3">
            <span className="text-property-surface-low/25">&middot;</span>
            <Link href={sibling.href} className="hover:text-property-surface-lowest transition-colors">
              {sibling.name}
            </Link>
          </span>
        ))}
      </div>

      <div className="w-full border-t border-property-surface-low/10 px-property-section-mobile py-6 text-center font-property-label text-property-label text-property-surface-low/50 md:px-property-gutter">
        <span>&copy; {new Date().getFullYear()} {profile.name}. All Rights Reserved.</span>
      </div>
    </footer>
  );
}
