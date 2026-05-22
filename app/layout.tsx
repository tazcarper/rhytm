import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { TopBar } from "@/src/components/shared/top-bar";
import "./globals.css";

// Brand typography. next/font self-hosts these so there's no FOUT and
// no third-party request at runtime. The CSS variables are consumed
// from app/globals.css via --serif and --sans aliases — components
// reach for those aliases, not the font-specific names.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rhythm Outdoors",
  description:
    "Booking platform for Horseshoe Bay Sporting Club, Hog Heaven Sporting Club, and Packsaddle Precision.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body>
        <TopBar />
        {children}
      </body>
    </html>
  );
}
