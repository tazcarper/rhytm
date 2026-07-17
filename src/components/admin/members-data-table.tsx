"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminMemberListRow } from "@/src/services/admin/members";
import { DataTable } from "@/src/components/ui/data-table";
import { MembershipStatusBadge } from "./membership-status-badge";
import { PropertyPill } from "./property-pill";

function formatJoinedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

const memberColumns: ColumnDef<AdminMemberListRow>[] = [
  {
    accessorKey: "primaryName",
    header: "Member",
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-olive">
          {row.original.primaryName ?? "—"}
        </span>
        {row.original.primaryDisplayName &&
          row.original.primaryDisplayName !== row.original.primaryName && (
            <span className="font-serif text-[13px] italic text-gray">
              &ldquo;{row.original.primaryDisplayName}&rdquo;
            </span>
          )}
        <span className="text-micro text-gray">
          {row.original.primaryEmail ?? "no contact on file"}
        </span>
      </div>
    ),
  },
  {
    id: "memberships",
    header: "Memberships",
    enableSorting: false,
    cell: ({ row }) => (
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {row.original.memberships.map((membership) => (
          <li
            key={membership.membershipId}
            className="flex flex-wrap items-center gap-2"
          >
            <MembershipStatusBadge status={membership.status} />
            <PropertyPill
              name={membership.propertyName}
              slug={membership.propertySlug}
            />
            <span className="font-mono text-micro text-gray">
              #{membership.memberNumber}
            </span>
            {membership.householdSize > 1 && (
              <span className="text-micro text-gray">
                household of {membership.householdSize}
              </span>
            )}
          </li>
        ))}
      </ul>
    ),
  },
  {
    accessorKey: "earliestJoined",
    header: "Joined",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-micro text-gray">
        {formatJoinedDate(row.original.earliestJoined)}
      </span>
    ),
  },
];

/**
 * Members directory on the generic DataTable. Filtering + pagination stay
 * server-side (URL params, see app/admin/members/page.tsx). Membership
 * status is a labeled badge — the audit retired the color-only dot.
 */
export function MembersDataTable({
  rows,
}: {
  rows: ReadonlyArray<AdminMemberListRow>;
}) {
  const router = useRouter();
  return (
    <DataTable
      columns={memberColumns}
      data={rows as AdminMemberListRow[]}
      onRowClick={(row) => {
        if (row.personId) router.push(`/admin/members/${row.personId}`);
      }}
      showToolbar={false}
      showPagination={false}
      emptyMessage="No members match these filters."
    />
  );
}
