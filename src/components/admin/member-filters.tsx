"use client";

import { useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, cn } from "@/lib/ui";
import {
  MEMBERSHIP_STATUSES,
  type AdminMemberListFilters,
  type MembershipStatus,
} from "@/src/services/admin/members";
import { membershipStatusLabel } from "./membership-status-badge";
import type { PublicProperty } from "@/src/services/public/properties";
import s from "./queue-list.module.css";

interface MemberFiltersProps {
  current: AdminMemberListFilters;
  properties: ReadonlyArray<PublicProperty>;
  tiers: ReadonlyArray<string>;
  basePath: string;
}

function buildStatusHref(
  basePath: string,
  current: AdminMemberListFilters,
  next: MembershipStatus | undefined,
): string {
  const queryParams = new URLSearchParams();
  if (next) queryParams.set("status", next);
  if (current.propertyId) queryParams.set("propertyId", current.propertyId);
  if (current.tier) queryParams.set("tier", current.tier);
  if (current.q) queryParams.set("q", current.q);
  const queryString = queryParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function MemberFilters({
  current,
  properties,
  tiers,
  basePath,
}: MemberFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const allActive = !current.status;

  // Remount the form whenever applied values change so Reset/Apply actually
  // clear the uncontrolled search + select inputs (defaultValue only applies
  // on mount). Excludes the status chips, so chip clicks don't wipe typing.
  const formKey = [
    current.q ?? "",
    current.propertyId ?? "",
    current.tier ?? "",
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
      <div className={s.statusPills}>
        <Link
          href={buildStatusHref(basePath, current, undefined)}
          className={cn(s.pill, allActive && s.pillActive)}
        >
          All
        </Link>
        {MEMBERSHIP_STATUSES.map((status) => (
          <Link
            key={status}
            href={buildStatusHref(basePath, current, status)}
            className={cn(s.pill, current.status === status && s.pillActive)}
          >
            {membershipStatusLabel(status)}
          </Link>
        ))}
        {isPending && <span className={s.searching}>Loading…</span>}
      </div>

      <form key={formKey} onSubmit={handleSubmit} className={s.advanced}>
        {current.status && (
          <input type="hidden" name="status" value={current.status} />
        )}

        <label className={s.field}>
          <span className={s.fieldLabel}>Search</span>
          <input
            type="search"
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Name, email, or member #"
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

        {tiers.length > 0 && (
          <label className={s.field}>
            <span className={s.fieldLabel}>Tier</span>
            <select
              name="tier"
              defaultValue={current.tier ?? ""}
              className={s.select}
            >
              <option value="">All tiers</option>
              {tiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className={s.actions}>
          <Button
            asChild
            variant="secondary"
            size="sm"
            className={s.resetAction}
          >
            <Link href={basePath}>Reset</Link>
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={isPending}>
            {isPending ? "Searching…" : "Apply"}
          </Button>
        </div>
      </form>
    </div>
  );
}
