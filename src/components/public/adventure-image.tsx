import type { CSSProperties } from "react";
import Image from "next/image";

// Shared image renderer for adventure surfaces (tile, hero, chapters,
// gallery). Always fills a positioned, aspect-sized parent (object-fit:
// cover), so every call site supplies the box via CSS and this just paints
// it.
//
// Optimization with a safety net: for hosts we've whitelisted in
// next.config's images.remotePatterns we use next/image (responsive
// srcset, AVIF/WebP, lazy). For ANY other host — e.g. an arbitrary URL an
// admin pasted into the editor — next/image would throw and take down the
// whole public page, so we fall back to a plain <img>. Keep
// OPTIMIZABLE_HOSTS in sync with next.config.ts.

const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

const OPTIMIZABLE_HOSTS = new Set(
  [SUPABASE_HOST, "picsum.photos", "fastly.picsum.photos"].filter(Boolean),
);

function canOptimize(src: string): boolean {
  try {
    return OPTIMIZABLE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false; // relative/blank/invalid → plain <img>
  }
}

// Inline fill for the fallback path, mirroring what next/image's `fill`
// applies, so the two branches lay out identically. object-fit:cover is
// also set by each call site's className; this guarantees it regardless.
const FILL_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

export function AdventureImage({
  src,
  alt,
  sizes,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  if (canOptimize(src)) {
    return (
      <Image src={src} alt={alt} fill sizes={sizes} className={className} priority={priority} />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- unknown host; next/image can't optimize it
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      style={FILL_STYLE}
    />
  );
}
