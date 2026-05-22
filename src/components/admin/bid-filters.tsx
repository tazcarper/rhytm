"use client";

import { useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, cn } from "@/lib/ui";
import {
  ADMIN_BID_STATUSES,
  type AdminBidListFilters,
  type AdminBidStatus,
} from "@/src/services/admin/bids";
import { bidStatusLabel } from "./bid-status-badge";
import type { PublicProperty } from "@/src/services/public/properties";
import s from "./bid-list.module.css";

interface BidFiltersProps {
  current: AdminBidListFilters;
  properties: ReadonlyArray<PublicProperty>;
  basePath: string;
}

function buildStatusHref(
  basePath: string,
  current: AdminBidListFilters,
  next: AdminBidStatus | undefined,
): string {
  const params = new URLSearchParams();
  if (next) params.set("status", next);
  if (current.propertyId) params.set("propertyId", current.propertyId);
  if (current.from) params.set("from", current.from);
  if (current.to) params.set("to", current.to);
  if (current.q) params.set("q", current.q);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function BidFilters({ current, properties, basePath }: BidFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const allActive = !current.status;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      const v = String(value).trim();
      if (v) params.set(key, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
  };

  return (
    <div className={s.filters}>
      <div className={s.statusPills}>
        <Link
          href={buildStatusHref(basePath, current, undefined)}
          className={cn(s.pill, allActive && s.pillActive)}
        >
          All
        </Link>
        {ADMIN_BID_STATUSES.map((status) => {
          const active = current.status === status;
          return (
            <Link
              key={status}
              href={buildStatusHref(basePath, current, status)}
              className={cn(s.pill, active && s.pillActive)}
            >
              {bidStatusLabel(status)}
            </Link>
          );
        })}
        {isPending && <span className={s.searching}>Loading…</span>}
      </div>

      <form onSubmit={handleSubmit} className={s.advanced}>
        {current.status && (
          <input type="hidden" name="status" value={current.status} />
        )}

        <label className={s.field}>
          <span className={s.fieldLabel}>Search</span>
          <input
            type="search"
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Guest name or email"
            className={s.input}
          />
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>Property</span>
          <select
            name="propertyId"
            defaultValue={current.propertyId ?? ""}
            className={s.select}
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>From (booking date)</span>
          <input
            type="date"
            name="from"
            defaultValue={current.from ?? ""}
            className={s.input}
          />
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>To (booking date)</span>
          <input
            type="date"
            name="to"
            defaultValue={current.to ?? ""}
            className={s.input}
          />
        </label>

        <div className={s.actions}>
          <Button asChild variant="secondary" size="sm">
            <Link href={basePath}>Reset</Link>
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isPending}
          >
            {isPending ? "Searching…" : "Apply"}
          </Button>
        </div>
      </form>
    </div>
  );
}
