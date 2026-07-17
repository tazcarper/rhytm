"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminInquiryListRow, InquiryType } from "@/src/services/admin/inquiries";
import { DataTable } from "@/src/components/ui/data-table";
import { InquiryStatusBadge } from "./inquiry-status-badge";

const TYPE_LABEL: Record<InquiryType, string> = {
  membership: "Membership",
  private_event: "Private event",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
}

const inquiryColumns: ColumnDef<AdminInquiryListRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <span className="font-medium text-olive">{row.original.name}</span>,
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    id: "inquiryType",
    header: "Type",
    cell: ({ row }) => (
      <span className="text-[13px] text-olive">{TYPE_LABEL[row.original.inquiryType]}</span>
    ),
  },
  {
    accessorKey: "propertyName",
    header: "Property",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <InquiryStatusBadge status={row.original.status} />,
  },
  {
    id: "createdAt",
    header: "Received",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-micro text-gray">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
];

export function InquiriesDataTable({ rows }: { rows: ReadonlyArray<AdminInquiryListRow> }) {
  const router = useRouter();
  return (
    <DataTable
      columns={inquiryColumns}
      data={rows as AdminInquiryListRow[]}
      filterColumnId="name"
      filterPlaceholder="Search inquiries…"
      onRowClick={(row) => router.push(`/admin/inquiries/${row.id}`)}
      pageSize={20}
      emptyMessage="Nothing here."
    />
  );
}
