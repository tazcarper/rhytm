"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { AdminEventListRow } from "@/src/services/admin/events";
import { duplicateEventFromTemplateAction } from "@/app/admin/events/actions";
import { Button } from "@/lib/ui";
import { DataTable } from "@/src/components/ui/data-table";
import { EventStatusBadge } from "./event-status-badge";
import s from "./bid-editor-form.module.css";

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

function formatWhen(row: AdminEventListRow): string {
  if (row.startAt) return formatDate(row.startAt);
  if (row.scheduleText) return row.scheduleText;
  return "—";
}

function formatPrice(value: number | null): string {
  return value === null ? "Free" : `$${value.toFixed(0)}`;
}

function DuplicateButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        startTransition(async () => {
          const result = await duplicateEventFromTemplateAction(eventId);
          if (result.ok) router.push(`/admin/events/${result.id}`);
        });
      }}
    >
      {isPending ? "Duplicating…" : "Duplicate"}
    </Button>
  );
}

function buildColumns(): ColumnDef<AdminEventListRow>[] {
  return [
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
        <span className="whitespace-nowrap text-[13px] text-olive">{formatWhen(row.original)}</span>
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
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => <DuplicateButton eventId={row.original.id} />,
    },
  ];
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Live & drafts" },
  { value: "draft", label: "Drafts only" },
  { value: "live", label: "Live only" },
];

export function EventsDataTable({
  rows,
  properties,
}: {
  rows: ReadonlyArray<AdminEventListRow>;
  properties?: ReadonlyArray<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const columns = useMemo(buildColumns, []);

  const [typeFilter, setTypeFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const typeOptions = useMemo(
    () => [...new Set(rows.map((row) => row.type).filter((value): value is string => Boolean(value)))].sort(),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!typeFilter || row.type === typeFilter) &&
          (!propertyFilter || row.propertyName === propertyFilter) &&
          (!statusFilter || (statusFilter === "draft" ? row.status === "draft" : row.status !== "draft")),
      ),
    [rows, typeFilter, propertyFilter, statusFilter],
  );

  const isFiltering = Boolean(typeFilter || propertyFilter || statusFilter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(evt) => setTypeFilter(evt.target.value)}
          className={s.input}
          style={{ width: "auto" }}
        >
          <option value="">All types</option>
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {properties && properties.length > 0 && (
          <select
            value={propertyFilter}
            onChange={(evt) => setPropertyFilter(evt.target.value)}
            className={s.input}
            style={{ width: "auto" }}
          >
            <option value="">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.name}>
                {property.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(evt) => setStatusFilter(evt.target.value)}
          className={s.input}
          style={{ width: "auto" }}
        >
          {STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {isFiltering && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setTypeFilter("");
              setPropertyFilter("");
              setStatusFilter("");
            }}
          >
            Clear filters
          </Button>
        )}
        {isFiltering && (
          <span className="text-[13px] text-gray">
            {filteredRows.length} / {rows.length} events
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredRows as AdminEventListRow[]}
        filterColumnId="title"
        filterPlaceholder="Search events…"
        onRowClick={(row) => router.push(`/admin/events/${row.id}`)}
        pageSize={15}
        emptyMessage={isFiltering ? "No saved events match these filters." : "No events yet. Create your first one."}
      />
    </div>
  );
}
