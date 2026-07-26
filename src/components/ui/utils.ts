import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui-compatible class joiner: clsx (conditional classes) + tailwind-merge
 * (dedupes conflicting Tailwind utilities so the last one wins).
 *
 * NOTE: distinct from the pre-existing `lib/ui/utils/cn.ts` (a plain join used by
 * the legacy CSS-Module primitives). During the dashboard migration both exist;
 * this one is what every shadcn/TanStack component in `src/components/ui` uses.
 * Collapse them in Phase 5 (see DASHBOARD_MIGRATION.md).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
