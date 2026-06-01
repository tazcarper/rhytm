"use client";

import { useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui";
import type { AdminBidListFilters } from "@/src/services/admin/bids";
import type { PublicProperty } from "@/src/services/public/properties";
import { BidFiltersGroups } from "./bid-filters-groups";
import { buildBidsHref } from "./bid-filter-params";
import s from "./queue-list.module.css";

interface BidFiltersProps {
  current: AdminBidListFilters;
  properties: ReadonlyArray<PublicProperty>;
  basePath: string;
}

export function BidFilters({ current, properties, basePath }: BidFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // The search / property / date inputs are uncontrolled (defaultValue), so
  // navigating to a new URL won't reset them on its own — defaultValue only
  // applies on mount. Keying the form on the applied values remounts it
  // whenever they change (Reset clears them, Apply updates them), so the
  // inputs always reflect the live filters. The key intentionally excludes
  // the status chips, so clicking a chip doesn't discard unsubmitted typing.
  const formKey = [
    current.q ?? "",
    current.propertyId ?? "",
    current.from ?? "",
    current.to ?? "",
  ].join("|");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const queryParams = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      const trimmed = String(value).trim();
      if (trimmed) queryParams.set(key, trimmed);
    }
    const queryString = queryParams.toString();
    startTransition(() => {
      router.push(queryString ? `${basePath}?${queryString}` : basePath);
    });
  };

  return (
    <div className={s.filters}>
      <BidFiltersGroups current={current} basePath={basePath} />

      <form key={formKey} onSubmit={handleSubmit} className={s.advanced}>
        {/* Preserve the active chip selections across an Apply. */}
        {current.statusGroup && (
          <input type="hidden" name="statusGroup" value={current.statusGroup} />
        )}
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
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
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
          <Button
            asChild
            variant="secondary"
            size="sm"
            className={s.resetAction}
          >
            <Link href={buildBidsHref(basePath, {}, {})}>Reset</Link>
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={isPending}>
            {isPending ? "Searching…" : "Apply"}
          </Button>
          {isPending && <span className={s.searching}>Loading…</span>}
        </div>
      </form>
    </div>
  );
}
