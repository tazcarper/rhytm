"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/ui";
import { signOut } from "@/lib/auth/actions";
import type { Viewer } from "@/src/services/shared/viewer";
import type { PropertyProfile } from "@/src/constants/public/property-profiles";

interface PropertyHeaderProps {
  profile: PropertyProfile;
  viewer: Viewer | null;
}

const NAV_LINK_CLASS =
  "font-property-label text-property-eyebrow uppercase tracking-widest text-property-ink hover:text-property-accent transition-colors duration-300";

// Page nav items (Club Life / Adventure / Education / …) get an accent
// underline on whichever one the visitor is currently on — matches the
// mockup's `border-b-2 border-accent` active treatment, which the header
// previously never applied at all.
function pageNavLinkClass(pathname: string, href: string): string {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return cn(
    "font-property-label text-property-eyebrow uppercase tracking-widest transition-colors duration-300",
    active
      ? "border-b-2 border-property-accent pb-1 font-bold text-property-ink"
      : "text-property-ink hover:text-property-accent",
  );
}

// Sticky two-row header shared by every page on a property site: brand
// row (logo centered, auth affordance top-right) + nav row. Signed-out
// visitors get a plain link to the existing /login page — no modal —
// matching the global SiteHeader's own pattern. Signed-in visitors see a
// greeting + sign out.
export function PropertyHeader({ profile, viewer }: PropertyHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 flex w-full flex-col border-b border-property-ink/20 bg-property-bg">
      <div className="mx-auto grid w-full max-w-property-max grid-cols-3 items-center px-property-section-mobile py-4 md:px-property-gutter">
        <div aria-hidden="true" />
        <Link
          href={`/${profile.slug}`}
          className="flex items-center justify-center"
          aria-label={`${profile.name}, Home`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.logoSrc} alt={profile.name} className="h-16 w-auto object-contain" />
        </Link>
        <div className="flex items-center justify-end gap-6">
          <div className="hidden items-center gap-4 md:flex">
            {viewer ? (
              <>
                <span className="font-property-sans text-[13px] text-property-ink">
                  Hello, <strong>{viewer.displayName}</strong>
                </span>
                <form action={signOut}>
                  <button type="submit" className={NAV_LINK_CLASS}>
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 py-3 font-property-label text-[13px] font-semibold uppercase tracking-[0.1em] text-property-ink transition-colors hover:text-property-accent-dark"
              >
                Member&rsquo;s Entrance
              </Link>
            )}
          </div>
          <button
            type="button"
            className="text-property-ink md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-7" /> : <Menu className="size-7" />}
          </button>
        </div>
      </div>

      <div className="hidden w-full justify-center border-t border-property-ink/10 py-3 md:flex">
        <ul className="flex gap-10">
          {profile.navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={pageNavLinkClass(pathname, link.href)}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {menuOpen && (
        <div className="flex flex-col gap-1 border-t border-property-ink/10 bg-property-bg px-property-section-mobile py-4 md:hidden">
          {profile.navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pageNavLinkClass(pathname, link.href) + " py-2"}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-property-ink/10 pt-3">
            {viewer ? (
              <form action={signOut}>
                <button type="submit" className={NAV_LINK_CLASS}>
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/login" className={NAV_LINK_CLASS} onClick={() => setMenuOpen(false)}>
                Member&rsquo;s Entrance
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
