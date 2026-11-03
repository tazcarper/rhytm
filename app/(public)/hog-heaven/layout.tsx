import type { ReactNode } from "react";
import localFont from "next/font/local";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentViewer } from "@/src/services/shared/viewer";
import { getResolvedPropertyProfile } from "@/src/services/public/property-profile";
import { PropertyHeader } from "@/src/components/public/property-template/property-header";
import { PropertyFooter } from "@/src/components/public/property-template/property-footer";

// Placeholder display/sans pairing standing in for the mockup's paid
// Adobe Typekit families (arpona / arponasans) until real licensing is
// confirmed — see src/styles/property-themes.css's header comment.
// Deliberately a different pairing than Horseshoe Bay's Fraunces/Libre
// Franklin so the two properties still read as visually distinct clubs
// even in placeholder-font mode.
const hhDisplay = localFont({
  // Spectral, latin subset, self-hosted (see src/styles/fonts/README.md).
  src: [
    { path: "../../../src/styles/fonts/spectral-latin-italic-400.woff2", weight: "400", style: "italic" },
    { path: "../../../src/styles/fonts/spectral-latin-italic-500.woff2", weight: "500", style: "italic" },
    { path: "../../../src/styles/fonts/spectral-latin-italic-600.woff2", weight: "600", style: "italic" },
    { path: "../../../src/styles/fonts/spectral-latin-normal-400.woff2", weight: "400", style: "normal" },
    { path: "../../../src/styles/fonts/spectral-latin-normal-500.woff2", weight: "500", style: "normal" },
    { path: "../../../src/styles/fonts/spectral-latin-normal-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-hh-display",
  display: "swap",
});

const hhSans = localFont({
  // Work Sans, latin subset, self-hosted (see src/styles/fonts/README.md).
  src: [
    { path: "../../../src/styles/fonts/work-sans-latin-normal-variable.woff2", weight: "400 700", style: "normal" },
  ],
  variable: "--font-hh-sans",
  display: "swap",
});

const PROPERTY_SLUG = "hog-heaven";

export default async function HogHeavenLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const [profile, viewer] = await Promise.all([
    getResolvedPropertyProfile(supabase, PROPERTY_SLUG),
    getCurrentViewer(supabase),
  ]);
  if (!profile) {
    throw new Error(`Missing property profile for "${PROPERTY_SLUG}"`);
  }

  return (
    <div
      data-property={PROPERTY_SLUG}
      className={`${hhDisplay.variable} ${hhSans.variable} flex min-h-screen flex-col bg-property-bg font-property-sans text-property-body text-property-ink selection:bg-property-camel selection:text-white`}
    >
      <PropertyHeader profile={profile} viewer={viewer} />
      <main className="flex w-full flex-grow flex-col">{children}</main>
      <PropertyFooter profile={profile} />
    </div>
  );
}
