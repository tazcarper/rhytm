"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminPromotionListRow } from "@/src/services/admin/promotions";
import type { PromotionPlacement } from "@/src/services/public/promotions";
import { DataTable } from "@/src/components/ui/data-table";
import { PromotionStatusBadge } from "./promotion-status-badge";

const PLACEMENT_LABEL: Record<PromotionPlacement, string> = {
  homepage_band: "Homepage",
  property_page: "Property pages",
  adventures_page: "Adventures",
};

function formatWindow(startsAt: string | null, endsAt: string | null): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/Chicago",
    }).format(new Date(iso));
  if (!startsAt && !endsAt) return "Always";
  if (startsAt && !endsAt) return `From ${fmt(startsAt)}`;
  if (!startsAt && endsAt) return `Until ${fmt(endsAt)}`;
  return `${fmt(startsAt as string)} – ${fmt(endsAt as string)}`;
}

const promotionColumns: ColumnDef<AdminPromotionListRow>[] = [
  {
    accessorKey: "title",
    header: "Promotion",
    cell: ({ row }) => (
      <span className="font-medium text-olive">{row.original.title}</span>
    ),
  },
  {
    id: "placements",
    header: "Placement",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.placements.length === 0 ? (
        <span className="text-micro text-gray">—</span>
      ) : (
        <span className="text-[13px] text-olive">
          {row.original.placements
            .map((placement) => PLACEMENT_LABEL[placement])
            .join(" · ")}
        </span>
      ),
  },
  {
    id: "scope",
    header: "Clubs",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-[13px] text-gray">
        {row.original.propertyNames.length === 0
          ? "All clubs"
          : row.original.propertyNames.join(", ")}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <PromotionStatusBadge status={row.original.status} />,
  },
  {
    id: "window",
    header: "When",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-micro text-gray">
        {formatWindow(row.original.startsAt, row.original.endsAt)}
      </span>
    ),
  },
];

export function PromotionsDataTable({
  rows,
}: {
  rows: ReadonlyArray<AdminPromotionListRow>;
}) {
  const router = useRouter();
  return (
    <DataTable
      columns={promotionColumns}
      data={rows as AdminPromotionListRow[]}
      filterColumnId="title"
      filterPlaceholder="Search promotions…"
      onRowClick={(row) => router.push(`/admin/promotions/${row.id}`)}
      pageSize={15}
      emptyMessage="No promotions yet. Create your first one."
    />
  );
}
