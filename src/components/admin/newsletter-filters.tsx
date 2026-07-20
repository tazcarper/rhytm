"use client";

import { useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui";
import type { AdminNewsletterSignupFilters } from "@/src/services/admin/newsletter";
import type { PublicProperty } from "@/src/services/public/properties";
import s from "./queue-list.module.css";

interface NewsletterFiltersProps {
  current: AdminNewsletterSignupFilters;
  properties: ReadonlyArray<PublicProperty>;
  basePath: string;
}

export function NewsletterFilters({ current, properties, basePath }: NewsletterFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Remount the form whenever applied values change so Reset/Apply actually
  // clear the uncontrolled search + select inputs (defaultValue only applies
  // on mount).
  const formKey = [current.q ?? "", current.propertyId ?? ""].join("|");

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
      <form key={formKey} onSubmit={handleSubmit} className={s.advanced}>
        <label className={s.field}>
          <span className={s.fieldLabel}>Search</span>
          <input
            type="search"
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Email"
            className={s.input}
          />
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>Property</span>
          <select name="propertyId" defaultValue={current.propertyId ?? ""} className={s.select}>
            <option value="">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

        <div className={s.actions}>
          <Button asChild variant="secondary" size="sm" className={s.resetAction}>
            <Link href={basePath}>Reset</Link>
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={isPending}>
            {isPending ? "Searching…" : "Apply"}
          </Button>
        </div>
      </form>
      {isPending && <span className={s.searching}>Loading…</span>}
    </div>
  );
}
