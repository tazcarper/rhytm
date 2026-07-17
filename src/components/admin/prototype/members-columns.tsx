"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/src/components/ui/badge";

/**
 * PROTOTYPE — column defs for the shadcn/TanStack Members table.
 * Self-contained mock shape (no service dependency) so the prototype page can
 * render without a DB. When promoted to /admin/members (Phase 2) these columns
 * bind to `AdminMemberListRow` from `@/src/services/admin/members`.
 * See DASHBOARD_MIGRATION.md.
 */
export interface MemberRow {
  personId: string;
  name: string;
  displayName?: string;
  email: string | null;
  property: string;
  memberNumber: string;
  status: "active" | "pending" | "lapsed";
  joined: string; // ISO date
}

const STATUS_VARIANT: Record<
  MemberRow["status"],
  React.ComponentProps<typeof Badge>["variant"]
> = {
  active: "success",
  pending: "warn",
  lapsed: "muted",
};

function formatJoined(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export const memberColumns: ColumnDef<MemberRow>[] = [
  {
    accessorKey: "name",
    header: "Member",
    cell: ({ row }) => {
      const member = row.original;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{member.name}</span>
          {member.displayName && member.displayName !== member.name ? (
            <span className="text-micro italic text-foreground">
              “{member.displayName}”
            </span>
          ) : null}
          <span className="text-micro text-muted-foreground">
            {member.email ?? "no contact on file"}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "property",
    header: "Property",
    cell: ({ row }) => (
      <span className="text-body text-foreground">{row.original.property}</span>
    ),
  },
  {
    accessorKey: "memberNumber",
    header: "Member #",
    cell: ({ row }) => (
      <span className="text-micro tabular-nums text-muted-foreground">
        #{row.original.memberNumber}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "joined",
    header: "Joined",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-micro text-muted-foreground">
        {formatJoined(row.original.joined)}
      </span>
    ),
  },
];
