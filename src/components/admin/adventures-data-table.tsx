"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";
import type { AdminAdventureListRow } from "@/src/services/admin/adventures";
import type { AdventureStatus } from "@/src/services/adventures/display";
import { formatDateRange } from "@/src/services/public/format";
import { DataTable } from "@/src/components/ui/data-table";
import { humanizeEnum } from "./humanize";

const PAYMENT_LABEL: Record<string, string> = {
  instant: "Full pay",
  deposit: "Deposit",
  inquire: "Inquire",
};

// Adventure lifecycle → the brand badge vocabulary (labeled, never raw
// snake_case — the audit flagged `sold_out`/`published` leaking as text).
const STATUS_VARIANT: Record<AdventureStatus, BadgeVariant> = {
  draft: "draft",
  published: "open",
  sold_out: "full",
  cancelled: "full",
  completed: "past",
};

const adventureColumns: ColumnDef<AdminAdventureListRow>[] = [
  {
    accessorKey: "title",
    header: "Adventure",
    cell: ({ row }) => (
      <Link
        href={`/admin/adventures/${row.original.id}`}
        className="font-serif text-[16px] italic text-olive no-underline hover:underline"
      >
        {row.original.title}
      </Link>
    ),
  },
  {
    accessorKey: "propertyName",
    header: "Property",
  },
  {
    accessorKey: "startDate",
    header: "When",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-gray">
        {formatDateRange(row.original.startDate, row.original.endDate)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status] ?? "draft"}>
        {humanizeEnum(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "paymentMode",
    header: "Payment",
    cell: ({ row }) =>
      PAYMENT_LABEL[row.original.paymentMode] ??
      humanizeEnum(row.original.paymentMode),
  },
  {
    accessorKey: "occupied",
    header: "Booked",
    cell: ({ row }) => (
      <span className="font-mono text-[13px]">
        {row.original.occupied} / {row.original.maxCapacity}
      </span>
    ),
  },
  {
    accessorKey: "requested",
    header: "Requests",
    cell: ({ row }) => (
      <span className="font-mono text-[13px] text-tan-deep">
        {row.original.requested > 0 ? row.original.requested : "—"}
      </span>
    ),
  },
];

/**
 * Adventures index on the generic DataTable — client-side search, sorting,
 * and pagination (the list isn't server-paginated).
 */
export function AdventuresDataTable({
  rows,
}: {
  rows: ReadonlyArray<AdminAdventureListRow>;
}) {
  const router = useRouter();
  return (
    <DataTable
      columns={adventureColumns}
      data={rows as AdminAdventureListRow[]}
      filterColumnId="title"
      filterPlaceholder="Search adventures…"
      onRowClick={(row) => router.push(`/admin/adventures/${row.id}`)}
      pageSize={15}
      emptyMessage="No adventures yet. Create the first one."
    />
  );
}
