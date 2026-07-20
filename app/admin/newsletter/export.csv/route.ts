import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminNewsletterSignupsForExport } from "@/src/services/admin/newsletter";

export const dynamic = "force-dynamic";

// CSV export of newsletter signups, respecting the same propertyId/q filters
// as the admin list page. Gated by the /admin middleware allowlist; the
// query itself is RLS-scoped to staff (admin / property_manager).
function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId") || undefined;
  const q = url.searchParams.get("q") || undefined;

  const supabase = await createServerSupabaseClient();
  const rows = await getAdminNewsletterSignupsForExport(supabase, { propertyId, q });

  const header = ["Email", "Property", "Signed Up"].join(",");
  const body = rows
    .map((r) => [r.email, r.propertyName, r.createdAt].map(csvCell).join(","))
    .join("\n");

  return new Response(`${header}\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-signups.csv"`,
    },
  });
}
