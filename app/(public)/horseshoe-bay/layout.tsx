import type { ReactNode } from "react";
import { Fraunces, Libre_Franklin } from "next/font/google";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentViewer } from "@/src/services/shared/viewer";
import { getPropertyProfile } from "@/src/constants/public/property-profiles";
import { PropertyHeader } from "@/src/components/public/property-template/property-header";
import { PropertyFooter } from "@/src/components/public/property-template/property-footer";

// Placeholder display/sans pairing standing in for the mockup's paid
// Adobe Typekit families (shackleton / freight-neo-pro) until real
// licensing is confirmed — see src/styles/property-themes.css's header
// comment. Fraunces' italic carries the "Silverspoon accent" role;
// Libre Franklin covers eyebrow/label/body, all previously freight-neo-pro.
const hsbDisplay = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-hsb-display",
  display: "swap",
});

const hsbSans = Libre_Franklin({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hsb-sans",
  display: "swap",
});

const PROPERTY_SLUG = "horseshoe-bay";

export default async function HorseshoeBayLayout({ children }: { children: ReactNode }) {
  const profile = getPropertyProfile(PROPERTY_SLUG);
  if (!profile) {
    throw new Error(`Missing property profile for "${PROPERTY_SLUG}"`);
  }

  const supabase = await createServerSupabaseClient();
  const viewer = await getCurrentViewer(supabase);

  return (
    <div
      data-property={PROPERTY_SLUG}
      className={`${hsbDisplay.variable} ${hsbSans.variable} flex min-h-screen flex-col bg-property-bg font-property-sans text-property-body text-property-ink selection:bg-property-camel selection:text-white`}
    >
      <PropertyHeader profile={profile} viewer={viewer} />
      <main className="flex w-full flex-grow flex-col">{children}</main>
      <PropertyFooter profile={profile} />
    </div>
  );
}
