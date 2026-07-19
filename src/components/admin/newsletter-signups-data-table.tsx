"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { AdminNewsletterSignupRow } from "@/src/services/admin/newsletter";
import { DataTable } from "@/src/components/ui/data-table";
import { PropertyPill } from "./property-pill";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
}

const signupColumns: ColumnDef<AdminNewsletterSignupRow>[] = [
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <span className="font-medium text-olive">{row.original.email}</span>,
  },
  {
    id: "property",
    header: "Property",
    cell: ({ row }) => (
      <PropertyPill name={row.original.propertyName} slug={row.original.propertySlug} />
    ),
  },
  {
    id: "createdAt",
    header: "Signed Up",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-micro text-gray">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
];

/**
 * Newsletter signups on the generic DataTable. Filtering + pagination stay
 * server-side (URL params, see app/admin/newsletter/page.tsx) — no row
 * click, there's no per-signup detail page.
 */
export function NewsletterSignupsDataTable({
  rows,
}: {
  rows: ReadonlyArray<AdminNewsletterSignupRow>;
}) {
  return (
    <DataTable
      columns={signupColumns}
      data={rows as AdminNewsletterSignupRow[]}
      showToolbar={false}
      showPagination={false}
      emptyMessage="No newsletter signups match these filters."
    />
  );
}
