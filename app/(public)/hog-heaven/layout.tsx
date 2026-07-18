import type { ReactNode } from "react";
import { Spectral, Work_Sans } from "next/font/google";
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
const hhDisplay = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-hh-display",
  display: "swap",
});

const hhSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
