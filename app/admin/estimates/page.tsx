import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import {
  listEstimateRequests,
  ESTIMATE_STATUSES,
  ESTIMATE_STATUS_LABELS,
  ESTIMATE_CHANNEL_LABELS,
  type EstimateRequestRow,
  type EstimateStatus,
} from "@/src/services/estimates/admin-estimates";
import { formatDateLong } from "@/src/services/public/format";
import s from "@/src/components/admin/queue-list.module.css";

export const dynamic = "force-dynamic";

function partyLabel(row: EstimateRequestRow): string {
  const parts = [`${row.adults} adult${row.adults === 1 ? "" : "s"}`];
  if (row.juniors > 0) parts.push(`${row.juniors} junior${row.juniors === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export default async function AdminEstimatesPage() {
  const supabase = await createServerSupabaseClient();
  const rows = await listEstimateRequests(supabase);

  // Group newest-first rows into status buckets, in pipeline order. Empty
  // buckets are skipped so the page reads as a worklist.
  const byStatus = new Map<EstimateStatus, EstimateRequestRow[]>();
  for (const status of ESTIMATE_STATUSES) byStatus.set(status, []);
  for (const row of rows) byStatus.get(row.status)?.push(row);

  return (
    <PageShell width="wide">
      <AdminBreadcrumb segments={[{ label: "Admin", href: "/admin" }, { label: "Estimates" }]} />
      <Heading level={1} size="h2">
        Estimate requests
      </Heading>
      <p className={s.summary}>
        Leads from the public Request-an-Estimate front door and staff phone intake. Open one to
        review what the customer asked for, then build the binding bid with the existing tools.
        {rows.length > 0 && ` · ${rows.length} total`}
      </p>

      {rows.length === 0 && (
        <div className={s.tableWrap}>
          <div className={s.empty}>
            No estimate requests yet. New ones arrive from{" "}
            <Link href="/request-estimate" className={s.viewLink}>
              /request-estimate
            </Link>
            .
          </div>
        </div>
      )}

      {ESTIMATE_STATUSES.map((status) => {
        const group = byStatus.get(status) ?? [];
        if (group.length === 0) return null;
        return (
          <section key={status} style={{ marginTop: "var(--space-6)" }}>
            <Heading level={2} size="h4">
              {ESTIMATE_STATUS_LABELS[status]}{" "}
              <span className={s.pillCount}>({group.length})</span>
            </Heading>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Channel</th>
                    <th>Club</th>
                    <th>Party</th>
                    <th>Indicative</th>
                    <th>Received</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className={s.guest}>
                          <span className={s.guestName}>{row.contactName}</span>
                          <span className={s.guestEmail}>{row.contactEmail}</span>
                        </div>
                      </td>
                      <td>{ESTIMATE_CHANNEL_LABELS[row.sourceChannel]}</td>
                      <td>{row.propertyName ?? "—"}</td>
                      <td>{partyLabel(row)}</td>
                      <td>{row.indicativeTotal ?? "—"}</td>
                      <td className={s.createdAt}>{formatDateLong(row.createdAt)}</td>
                      <td>
                        <Link href={`/admin/estimates/${row.id}`} className={s.viewLink}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </PageShell>
  );
}
