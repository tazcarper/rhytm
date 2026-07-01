"use client";

import { DataTable } from "@/src/components/ui/data-table";
import {
  memberColumns,
  type MemberRow,
} from "@/src/components/admin/prototype/members-columns";
import {
  BrandAreaChart,
  type BrandAreaChartPoint,
} from "@/src/components/ui/charts/brand-area-chart";

/**
 * PROTOTYPE PAGE — dashboard migration brand-fidelity review.
 * Route: /dev/ui/dashboard-prototype
 *
 * Renders the shadcn/ui + TanStack + Tremor-style stack against mock data so the
 * new components can be eyeballed next to the live hand-rolled /admin/members
 * list. Nothing here touches real data or admin routes. See DASHBOARD_MIGRATION.md.
 */

const MOCK_MEMBERS: MemberRow[] = [
  { personId: "1", name: "Eleanor Whitfield", displayName: "Nell", email: "nell@example.com", property: "Horseshoe Bay", memberNumber: "0142", status: "active", joined: "2023-04-01" },
  { personId: "2", name: "Marcus Delgado", email: "marcus.d@example.com", property: "Hog Heaven", memberNumber: "0207", status: "active", joined: "2024-01-15" },
  { personId: "3", name: "Priya Ramanathan", email: null, property: "Packsaddle Precision", memberNumber: "0311", status: "pending", joined: "2026-05-20" },
  { personId: "4", name: "Theodore Brandt III", displayName: "Teddy", email: "teddy@example.com", property: "Horseshoe Bay", memberNumber: "0088", status: "lapsed", joined: "2021-09-30" },
  { personId: "5", name: "Susanna Cole", email: "s.cole@example.com", property: "Hog Heaven", memberNumber: "0256", status: "active", joined: "2024-11-02" },
  { personId: "6", name: "Winston Achebe", email: "w.achebe@example.com", property: "Packsaddle Precision", memberNumber: "0299", status: "active", joined: "2025-02-18" },
  { personId: "7", name: "Margaret Osei", displayName: "Peggy", email: "peggy.o@example.com", property: "Horseshoe Bay", memberNumber: "0173", status: "pending", joined: "2026-06-11" },
  { personId: "8", name: "Rafael Montoya", email: "rafa@example.com", property: "Hog Heaven", memberNumber: "0134", status: "active", joined: "2023-07-24" },
  { personId: "9", name: "Beatrice Lindqvist", email: "bea.l@example.com", property: "Packsaddle Precision", memberNumber: "0402", status: "lapsed", joined: "2022-03-08" },
  { personId: "10", name: "Idris Kamau", email: "idris.k@example.com", property: "Horseshoe Bay", memberNumber: "0361", status: "active", joined: "2025-10-05" },
  { personId: "11", name: "Clara Fontaine", email: "clara.f@example.com", property: "Hog Heaven", memberNumber: "0410", status: "active", joined: "2026-03-29" },
  { personId: "12", name: "Desmond Park", email: "des.park@example.com", property: "Packsaddle Precision", memberNumber: "0055", status: "pending", joined: "2026-06-28" },
];

const MOCK_BOOKINGS: BrandAreaChartPoint[] = [
  { label: "Jan", value: 24 },
  { label: "Feb", value: 31 },
  { label: "Mar", value: 28 },
  { label: "Apr", value: 45 },
  { label: "May", value: 52 },
  { label: "Jun", value: 61 },
];

const KPIS = [
  { label: "Active members", value: "148", delta: "+12 this quarter" },
  { label: "Open bids", value: "23", delta: "6 awaiting signature" },
  { label: "Bookings (30d)", value: "61", delta: "+18% vs prior" },
  { label: "Deposit volume", value: "$84.2k", delta: "collected this month" },
];

export default function DashboardPrototypePage() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-eyebrow uppercase tracking-eyebrow text-tan-deep">
          Dashboard Migration · Prototype
        </p>
        <h1 className="font-serif text-h2 leading-tight text-olive">
          shadcn + TanStack + Tremor, in brand
        </h1>
        <p className="max-w-prose text-body text-gray">
          Mock data. Compare against the live{" "}
          <code className="rounded-sharp bg-paper-warm px-1">/admin/members</code>{" "}
          list — the header treatment, row striping/hover, borders, radius, and
          type should read as the same design language, just powered by a real
          table engine.
        </p>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="flex flex-col gap-1 rounded-card border border-rule bg-paper p-5 shadow-soft"
          >
            <span className="text-eyebrow uppercase tracking-label text-muted-foreground">
              {kpi.label}
            </span>
            <span className="font-serif text-h2 leading-none text-olive">
              {kpi.value}
            </span>
            <span className="text-micro text-gray">{kpi.delta}</span>
          </div>
        ))}
      </section>

      {/* Chart (Tremor path) */}
      <section className="flex flex-col gap-3 rounded-card border border-rule bg-paper p-6 shadow-soft">
        <div className="flex flex-col gap-0.5">
          <span className="text-eyebrow uppercase tracking-label text-muted-foreground">
            Bookings trend
          </span>
          <span className="font-serif text-h3 text-olive">Last 6 months</span>
        </div>
        <BrandAreaChart data={MOCK_BOOKINGS} />
      </section>

      {/* Members data table */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-eyebrow uppercase tracking-label text-muted-foreground">
            Directory
          </span>
          <span className="font-serif text-h3 text-olive">Members</span>
        </div>
        <DataTable
          columns={memberColumns}
          data={MOCK_MEMBERS}
          filterColumnId="name"
          filterPlaceholder="Search members…"
          pageSize={8}
        />
      </section>
    </div>
  );
}
