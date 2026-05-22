"use client";

import { useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, cn } from "@/lib/ui";
import {
  ADMIN_BOOKING_STATUSES,
  ADMIN_BOOKING_TYPES,
  type AdminBookingListFilters,
  type AdminBookingStatus,
} from "@/src/services/admin/bookings";
import { bookingStatusLabel } from "./booking-status-badge";
import type { PublicProperty } from "@/src/services/public/properties";
import s from "./queue-list.module.css";

interface BookingFiltersProps {
  current: AdminBookingListFilters;
  properties: ReadonlyArray<PublicProperty>;
  basePath: string;
}

const BOOKING_TYPE_LABEL: Record<(typeof ADMIN_BOOKING_TYPES)[number], string> = {
  plan_a_visit: "Plan a Visit",
  private_lesson: "Private Lesson",
  host_an_occasion: "Host an Occasion",
};

function buildStatusHref(
  basePath: string,
  current: AdminBookingListFilters,
  next: AdminBookingStatus | undefined,
): string {
  const queryParams = new URLSearchParams();
  if (next) queryParams.set("status", next);
  if (current.propertyId) queryParams.set("propertyId", current.propertyId);
  if (current.type) queryParams.set("type", current.type);
  if (current.from) queryParams.set("from", current.from);
  if (current.to) queryParams.set("to", current.to);
  if (current.q) queryParams.set("q", current.q);
  const queryString = queryParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function BookingFilters({
  current,
  properties,
  basePath,
}: BookingFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const allActive = !current.status;

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
        {ADMIN_BOOKING_STATUSES.map((status) => {
          const active = current.status === status;
          return (
            <Link
              key={status}
              href={buildStatusHref(basePath, current, status)}
              className={cn(s.pill, active && s.pillActive)}
            >
              {bookingStatusLabel(status)}
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
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>Type</span>
          <select
            name="type"
            defaultValue={current.type ?? ""}
            className={s.select}
          >
            <option value="">All types</option>
            {ADMIN_BOOKING_TYPES.map((bookingType) => (
              <option key={bookingType} value={bookingType}>
                {BOOKING_TYPE_LABEL[bookingType]}
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
