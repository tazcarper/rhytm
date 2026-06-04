import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdventureRoster } from "@/src/services/admin/adventures";

export const dynamic = "force-dynamic";

// CSV export of an adventure's roster. Gated by the /admin middleware
// allowlist; the roster query is RLS-scoped to the caller's properties.
function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const rows = await getAdventureRoster(supabase, id);

  const header = ["Member", "Member #", "Status", "Party", "Guests", "Paid"].join(",");
  const body = rows
    .map((r) =>
      [
        r.guestName,
        r.memberNumber,
        r.status,
        r.guestCount,
        r.guestNames.join("; "),
        r.amountPaid ?? "",
      ]
        .map(csvCell)
        .join(","),
    )
    .join("\n");

  return new Response(`${header}\n${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adventure-roster-${id}.csv"`,
    },
  });
}
