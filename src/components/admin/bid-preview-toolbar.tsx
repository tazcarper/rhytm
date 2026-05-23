"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  PREVIEW_LABELS,
  PREVIEW_STATES,
  isValidPreviewState,
} from "@/src/services/bids/preview";
import s from "./bid-preview-toolbar.module.css";

// Admin-only state-preview toolbar that pins to the top of public bid
// pages. Each button is a Link to the same URL with `?preview=<state>`.
// The page's server component reads the param + applies the override
// (see src/services/bids/preview.ts).
//
// Lives in src/components/admin/ rather than src/components/public/
// because it's an admin-side tool, even though it renders on a public
// route. The server component only mounts it for admin viewers, so
// guests never see it.

export function BidPreviewToolbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentRaw = searchParams.get("preview");
  const current = isValidPreviewState(currentRaw) ? currentRaw : null;

  const buildHref = (state: string | null): string => {
    const params = new URLSearchParams(searchParams.toString());
    if (state) {
      params.set("preview", state);
    } else {
      params.delete("preview");
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className={s.bar}>
      <span className={s.label}>Admin preview</span>
      <div className={s.buttons}>
        {PREVIEW_STATES.map((state) => (
          <Link
            key={state}
            href={buildHref(state)}
            className={`${s.button} ${current === state ? s.active : ""}`}
          >
            {PREVIEW_LABELS[state]}
          </Link>
        ))}
      </div>
      {current && (
        <Link href={buildHref(null)} className={s.clear}>
          Clear ✕
        </Link>
      )}
    </div>
  );
}
