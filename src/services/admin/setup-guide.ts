import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads the canonical client setup guide (docs/CLIENT_SETUP.md) so the
 * admin-only /admin/setup page can render exactly what the client follows —
 * one source of truth, no second copy to drift.
 *
 * Returns null if the file can't be read (e.g. not bundled in a serverless
 * build), so the page can fall back to the public HTML guide instead of
 * crashing. `next.config.ts` → `outputFileTracingIncludes` ships the markdown
 * with the /admin/setup route.
 */
export function getClientSetupGuideMarkdown(): string | null {
  try {
    return readFileSync(join(process.cwd(), "docs", "CLIENT_SETUP.md"), "utf8");
  } catch {
    return null;
  }
}
