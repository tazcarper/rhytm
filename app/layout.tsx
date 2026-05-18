import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
