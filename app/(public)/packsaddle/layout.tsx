import type { ReactNode } from "react";
import { Domine, Space_Grotesk, Zilla_Slab } from "next/font/google";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentViewer } from "@/src/services/shared/viewer";
import { getResolvedPropertyProfile } from "@/src/services/public/property-profile";
import { PropertyHeader } from "@/src/components/public/property-template/property-header";
import { PropertyFooter } from "@/src/components/public/property-template/property-footer";

// Placeholder trio standing in for the mockup's three type families until
// real licensing is confirmed — see src/styles/property-themes.css's header
// comment. "placa" (display) and "Fieldstone" (eyebrow/label) are both
// paid/unlicensed faces (Fieldstone's .otf files exist in the mockup
// handoff, but that isn't the same as holding a webfont-embedding license —
// same call already made for Horseshoe Bay's Silverspoon files); Zilla Slab
// (body) is genuinely free and loads for real. Domine + Space Grotesk keep
// Packsaddle visually distinct from Fraunces/Libre Franklin (Horseshoe Bay)
// and Spectral/Work Sans (Hog Heaven).
const psDisplay = Domine({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ps-display",
  display: "swap",
});

const psLabel = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-ps-label",
  display: "swap",
});

const psSans = Zilla_Slab({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-ps-sans",
  display: "swap",
});

const PROPERTY_SLUG = "packsaddle";

export default async function PacksaddleLayout({ children }: { children: ReactNode }) {
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
      className={`${psDisplay.variable} ${psLabel.variable} ${psSans.variable} flex min-h-screen flex-col bg-property-bg font-property-sans text-property-body text-property-ink selection:bg-property-camel selection:text-white`}
    >
      <PropertyHeader profile={profile} viewer={viewer} />
      <main className="flex w-full flex-grow flex-col">{children}</main>
      <PropertyFooter profile={profile} />
    </div>
  );
}
