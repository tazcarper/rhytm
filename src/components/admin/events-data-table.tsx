"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminEventListRow } from "@/src/services/admin/events";
import { DataTable } from "@/src/components/ui/data-table";
import { EventStatusBadge } from "./event-status-badge";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
}

function formatPrice(value: number | null): string {
  return value === null ? "Free" : `$${value.toFixed(0)}`;
}

const eventColumns: ColumnDef<AdminEventListRow>[] = [
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => (
      <span className="font-medium text-olive">
        {row.original.title}
        {row.original.isTemplate && (
          <span className="ml-2 text-micro uppercase tracking-label text-tan-deep">Template</span>
        )}
      </span>
    ),
  },
  {
    accessorKey: "propertyName",
    header: "Property",
  },
  {
    id: "startAt",
    header: "When",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-[13px] text-olive">
        {formatDate(row.original.startAt)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <EventStatusBadge status={row.original.status} />,
  },
  {
    id: "capacity",
    header: "Capacity",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-[13px] text-olive">
        {row.original.confirmedCount} / {row.original.maxCapacity}
      </span>
    ),
  },
  {
    id: "pricing",
    header: "Member / Non-member",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-[13px] text-gray">
        {formatPrice(row.original.memberPrice)} / {formatPrice(row.original.nonMemberPrice)}
      </span>
    ),
  },
];

export function EventsDataTable({ rows }: { rows: ReadonlyArray<AdminEventListRow> }) {
  const router = useRouter();
  return (
    <DataTable
      columns={eventColumns}
      data={rows as AdminEventListRow[]}
      filterColumnId="title"
      filterPlaceholder="Search events…"
      onRowClick={(row) => router.push(`/admin/events/${row.id}`)}
      pageSize={15}
      emptyMessage="No events yet. Create your first one."
    />
  );
}
