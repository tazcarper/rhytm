import type { ReactNode } from "react";
import localFont from "next/font/local";
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
const psDisplay = localFont({
  // Domine, latin subset, self-hosted (see src/styles/fonts/README.md).
  src: [
    { path: "../../../src/styles/fonts/domine-latin-normal-variable.woff2", weight: "400 700", style: "normal" },
  ],
  variable: "--font-ps-display",
  display: "swap",
});

// Space Grotesk, latin subset, self-hosted (see src/styles/fonts/README.md).
const psLabel = localFont({
  src: "../../../src/styles/fonts/space-grotesk-latin-variable.woff2",
  weight: "500 700",
  variable: "--font-ps-label",
  display: "swap",
});

const psSans = localFont({
  // Zilla Slab, latin subset, self-hosted (see src/styles/fonts/README.md).
  src: [
    { path: "../../../src/styles/fonts/zilla-slab-latin-italic-400.woff2", weight: "400", style: "italic" },
    { path: "../../../src/styles/fonts/zilla-slab-latin-italic-500.woff2", weight: "500", style: "italic" },
    { path: "../../../src/styles/fonts/zilla-slab-latin-italic-600.woff2", weight: "600", style: "italic" },
    { path: "../../../src/styles/fonts/zilla-slab-latin-italic-700.woff2", weight: "700", style: "italic" },
    { path: "../../../src/styles/fonts/zilla-slab-latin-normal-400.woff2", weight: "400", style: "normal" },
    { path: "../../../src/styles/fonts/zilla-slab-latin-normal-500.woff2", weight: "500", style: "normal" },
    { path: "../../../src/styles/fonts/zilla-slab-latin-normal-600.woff2", weight: "600", style: "normal" },
    { path: "../../../src/styles/fonts/zilla-slab-latin-normal-700.woff2", weight: "700", style: "normal" },
  ],
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
