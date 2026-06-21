import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Heading, PageShell } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { EstimateStatusSelect } from "@/src/components/admin/estimate-status-select";
import {
  getEstimateRequest,
  ESTIMATE_CHANNEL_LABELS,
} from "@/src/services/estimates/admin-estimates";
import { formatDateLong } from "@/src/services/public/format";
import s from "@/src/components/admin/queue-list.module.css";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-4)", padding: "var(--space-3) 0", borderTop: "1px solid var(--border)" }}>
      <div className={s.fieldLabel} style={{ minWidth: "160px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--sans)", fontSize: "var(--text-body)", color: "var(--olive)" }}>
        {children}
      </div>
    </div>
  );
}

export default async function AdminEstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const estimate = await getEstimateRequest(supabase, id);

  if (!estimate) notFound();

  const dateText = (iso: string | null) => (iso ? formatDateLong(iso) : "—");
  const addons = estimate.addons as { ammo?: number; gear?: number; cart?: boolean };
  const catering = estimate.catering as { tier?: string; name?: string; per?: number } | null;

  return (
    <PageShell width="narrow">
      <AdminBreadcrumb
        segments={[
          { label: "Admin", href: "/admin" },
          { label: "Estimates", href: "/admin/estimates" },
          { label: estimate.contactName },
        ]}
      />
      <Heading level={1} size="h2">
        {estimate.contactName}
      </Heading>
      <p className={s.summary}>
        {ESTIMATE_CHANNEL_LABELS[estimate.sourceChannel]} request · received{" "}
        {formatDateLong(estimate.createdAt)} · via {estimate.createdByLabel}
      </p>

      <div style={{ margin: "var(--space-5) 0" }}>
        <EstimateStatusSelect id={estimate.id} status={estimate.status} />
      </div>

      <Row label="Contact">
        <div>
          {estimate.contactEmail}
          {estimate.contactPhone ? ` · ${estimate.contactPhone}` : ""}
        </div>
      </Row>
      <Row label="Club">{estimate.propertyName ?? "— (unmapped / coming soon)"}</Row>
      <Row label="Party">
        {estimate.adults} adult{estimate.adults === 1 ? "" : "s"}
        {estimate.juniors > 0 ? ` · ${estimate.juniors} junior${estimate.juniors === 1 ? "" : "s"}` : ""}
      </Row>
      <Row label="Experiences">
        {estimate.experiences.length > 0 ? estimate.experiences.join(", ") : "—"}
      </Row>
      <Row label="Add-ons">
        {[
          addons.ammo ? `Ammo ×${addons.ammo}` : null,
          addons.gear ? `Gear ×${addons.gear}` : null,
          addons.cart ? "Drink cart" : null,
        ]
          .filter(Boolean)
          .join(" · ") || "—"}
      </Row>
      <Row label="Catering">
        {catering && catering.per ? `${catering.tier} · ${catering.name} ($${catering.per}/head)` : "—"}
      </Row>
      <Row label="Preferred date">{dateText(estimate.preferredDate)}</Row>
      <Row label="Backup date">{dateText(estimate.backupDate)}</Row>
      <Row label="Arrival">{estimate.arrival ?? "—"}</Row>
      <Row label="Indicative total">{estimate.indicativeTotal ?? "—"}</Row>
      <Row label="Notes">
        {estimate.notes ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{estimate.notes}</span>
        ) : (
          "—"
        )}
      </Row>

      <p className={s.summary} style={{ marginTop: "var(--space-6)" }}>
        Building the bid? Head to{" "}
        <Link href="/admin/bids" className={s.viewLink}>
          Bids
        </Link>{" "}
        — the convert-to-bid shortcut lands in a later update.
      </p>
    </PageShell>
  );
}
