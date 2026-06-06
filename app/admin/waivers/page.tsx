import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button, Card, Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getWaivers } from "@/src/services/admin/waivers";
import { getAdminPropertiesList } from "@/src/services/admin/properties";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Admin: signed-waiver roster + per-property walk-in kiosk links + a pointer
// to the template editor.
export default async function AdminWaiversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const [waivers, properties] = await Promise.all([
    getWaivers(supabase, q),
    getAdminPropertiesList(supabase),
  ]);

  return (
    <PageShell width="wide">
      <AdminBreadcrumb segments={[{ label: "Admin", href: "/admin" }, { label: "Waivers" }]} />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <Heading level={1} size="h2" underline>
          Waivers
        </Heading>
        <Link
          href="/admin/settings/waivers"
          className="font-sans text-[12px] uppercase tracking-[0.5px] text-tan-deep hover:text-olive"
        >
          Edit waiver templates →
        </Link>
      </div>

      <Card padding="loose" className="mt-6">
        <div className="font-serif font-semibold text-[18px] text-olive mb-1">
          Walk-in kiosk links
        </div>
        <p className="font-serif italic text-[14px] text-gray mt-0 mb-4">
          Open one of these on an iPad at the property and hand it to a guest to sign — no login
          needed. Bookmark the link for events.
        </p>
        <div className="flex flex-col items-start gap-3">
          {properties.map((property) => (
            <Button key={property.id} asChild variant="secondary" size="md">
              <Link href={`/waiver/${property.slug}`} target="_blank">
                Open {property.name} kiosk ↗
              </Link>
            </Button>
          ))}
        </div>
      </Card>

      <form method="get" className="mt-6 flex gap-2 max-w-md">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or email…"
          className="flex-1 border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper"
        />
        <button
          type="submit"
          className="font-sans text-[12px] uppercase tracking-[0.5px] text-olive border border-rule rounded-pill px-4 hover:bg-cream"
        >
          Search
        </button>
      </form>

      <Card padding="loose" className="mt-4">
        {waivers.length === 0 ? (
          <p className="font-serif italic text-[15px] text-gray m-0">
            {q ? "No waivers match that search." : "No signed waivers yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-sans text-[13px]">
              <thead>
                <tr className="text-left text-gray uppercase tracking-[0.5px] text-[11px]">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Signed</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {waivers.map((waiver) => (
                  <tr key={waiver.id} className="border-t border-rule text-olive">
                    <td className="py-2 pr-3 font-serif text-[15px]">{waiver.signedName}</td>
                    <td className="py-2 pr-3 font-mono text-[12px]">
                      {waiver.signerEmail ?? "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {waiver.bidId ? (
                        <Link href={`/admin/bids/${waiver.bidId}`}>Booking →</Link>
                      ) : (
                        <span>Walk-in{waiver.propertyName ? ` · ${waiver.propertyName}` : ""}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[12px]">{formatWhen(waiver.createdAt)}</td>
                    <td className="py-2 pr-3">
                      <a href={`/admin/waivers/${waiver.id}`} target="_blank" rel="noreferrer">
                        View PDF →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
