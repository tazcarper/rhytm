"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  formatDateLongTz,
  formatSlotLabelTz,
} from "@/src/services/public/format";
import type { AdminBidListRow } from "@/src/services/admin/bids";
import { DataTable } from "@/src/components/ui/data-table";
import { BidStatusBadge } from "./bid-status-badge";
import { BidProgress } from "./bid-progress";
import { BidRestoreButton } from "./bid-delete-controls";
import { PropertyPill } from "./property-pill";

const BOOKING_TYPE_LABEL: Record<AdminBidListRow["bookingType"], string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Private Lesson",
  host_an_occasion: "Host an Occasion",
};

function formatRelative(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const bidColumns: ColumnDef<AdminBidListRow>[] = [
  {
    accessorKey: "guestName",
    header: "Guest",
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-olive">{row.original.guestName}</span>
        <span className="text-micro text-gray">{row.original.guestEmail}</span>
      </div>
    ),
  },
  {
    accessorKey: "bookingType",
    header: "Booking",
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span>{BOOKING_TYPE_LABEL[row.original.bookingType]}</span>
        <span className="text-micro text-gray">
          {row.original.guestCount}{" "}
          {row.original.guestCount === 1 ? "guest" : "guests"} ·{" "}
          {row.original.durationHours}h
        </span>
      </div>
    ),
  },
  {
    accessorKey: "startTime",
    header: "When",
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span className="whitespace-nowrap">
          {formatDateLongTz(row.original.startTime, row.original.propertyTimezone)}
        </span>
        <span className="text-micro text-gray">
          {formatSlotLabelTz(row.original.startTime, row.original.propertyTimezone)}{" "}
          CT
        </span>
      </div>
    ),
  },
  {
    accessorKey: "propertyName",
    header: "Property",
    cell: ({ row }) => (
      <PropertyPill
        name={row.original.propertyName}
        slug={row.original.propertySlug}
      />
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        <BidStatusBadge status={row.original.status} display="stage" />
        <BidProgress
          status={row.original.status}
          signedAt={row.original.signedAt}
          amountPaid={row.original.amountPaid}
          depositAmount={row.original.depositAmount}
          effectiveQuote={row.original.effectiveQuote}
        />
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-micro text-gray">
        {formatRelative(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) =>
      row.original.deletedAt ? (
        <BidRestoreButton
          bidId={row.original.id}
          bookingId={row.original.bookingId}
        />
      ) : (
        <Link
          href={`/admin/bids/${row.original.id}`}
          className="whitespace-nowrap text-micro font-semibold uppercase tracking-label text-tan-deep no-underline hover:underline"
        >
          View →
        </Link>
      ),
  },
];

/**
 * Bids review queue on the generic DataTable. Filtering + pagination stay
 * server-side (URL params, see app/admin/bids/page.tsx) — the table adds
 * column sorting, column visibility off, and the whole-row click target.
 */
export function BidsDataTable({
  rows,
}: {
  rows: ReadonlyArray<AdminBidListRow>;
}) {
  const router = useRouter();
  return (
    <DataTable
      columns={bidColumns}
      data={rows as AdminBidListRow[]}
      onRowClick={(row) => router.push(`/admin/bids/${row.id}`)}
      showToolbar={false}
      showPagination={false}
      emptyMessage="No bids match these filters."
    />
  );
}
