"use client";

import { useState } from "react";
import { cn } from "@/lib/ui";
import s from "./property-image.module.css";

interface PropertyImageProps {
  src: string | null | undefined;
  alt: string;
  /** Shown on the placeholder box when no image is supplied yet — the
      slot's expected filename, so swapping in real photography later
      never requires touching this component. */
  filename?: string;
  className?: string;
}

// Graceful missing-photo pattern, ported from the mockups' .img-placeholder
// (a deliberately visible black box with a dashed outline and the
// expected filename) into a real component: a broken or absent `src`
// renders the placeholder instead of a broken-image icon, so pages read
// correctly before every photo slot is filled.
export function PropertyImage({ src, alt, filename, className }: PropertyImageProps) {
  const [errored, setErrored] = useState(false);
  const showPlaceholder = !src || errored;

  if (showPlaceholder) {
    return (
      <div className={cn(s.placeholder, className)} data-file={filename ?? alt} aria-label={alt} />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(s.image, className)}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}
