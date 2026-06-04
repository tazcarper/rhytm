import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminAdventuresList } from "@/src/services/admin/adventures";
import { Button, Eyebrow, Heading, PageShell } from "@/lib/ui";
import { formatDateRange } from "@/src/services/public/format";

export const dynamic = "force-dynamic";

const PAYMENT_LABEL: Record<string, string> = {
  instant: "Full pay",
  deposit: "Deposit",
  inquire: "Inquire",
};

// Admin adventures index — all properties (RLS scopes property managers
// to their own). Status + capacity + payment mode at a glance.
export default async function AdminAdventuresPage() {
  const supabase = await createServerSupabaseClient();
  const adventures = await getAdminAdventuresList(supabase);

  return (
    <PageShell width="wide">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
        <div>
          <Eyebrow as="div" className="mb-2">Admin</Eyebrow>
          <Heading level={1} size="h1">Adventures</Heading>
        </div>
        <Button asChild variant="primary">
          <Link href="/admin/adventures/new">New adventure</Link>
        </Button>
      </div>

      {adventures.length === 0 ? (
        <p className="font-serif italic text-gray">No adventures yet. Create the first one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-sans text-[14px]">
            <thead>
              <tr className="text-left text-gray uppercase tracking-[0.5px] text-[11px]">
                <th className="py-2 pr-3">Adventure</th>
                <th className="py-2 pr-3">Property</th>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Payment</th>
                <th className="py-2 pr-3">Booked</th>
                <th className="py-2 pr-3">Requests</th>
              </tr>
            </thead>
            <tbody>
              {adventures.map((a) => (
                <tr key={a.id} className="border-t border-rule">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/adventures/${a.id}`} className="font-serif text-[16px] text-olive italic no-underline hover:underline">
                      {a.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-olive">{a.propertyName}</td>
                  <td className="py-2 pr-3 text-gray">{formatDateRange(a.startDate, a.endDate)}</td>
                  <td className="py-2 pr-3 text-olive">{a.status}</td>
                  <td className="py-2 pr-3 text-olive">{PAYMENT_LABEL[a.paymentMode] ?? a.paymentMode}</td>
                  <td className="py-2 pr-3 font-mono text-olive">{a.occupied} / {a.maxCapacity}</td>
                  <td className="py-2 pr-3 font-mono text-tan-deep">{a.requested > 0 ? a.requested : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
