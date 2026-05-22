"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { updateAdminPropertyAction } from "@/app/admin/properties/actions";
import type { AdminProperty } from "@/src/services/admin/properties";
import { PropertyPill } from "./property-pill";
import s from "./bid-editor-form.module.css";

interface PropertySettingsFormProps {
  property: AdminProperty;
}

export function PropertySettingsForm({ property }: PropertySettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [bookingHorizonDays, setBookingHorizonDays] = useState(
    String(property.bookingHorizonDays),
  );
  const [maxConcurrentGroups, setMaxConcurrentGroups] = useState(
    String(property.maxConcurrentGroups),
  );
  const [tagline, setTagline] = useState(property.tagline ?? "");
  const [supportEmail, setSupportEmail] = useState(property.supportEmail ?? "");
  const [supportPhone, setSupportPhone] = useState(property.supportPhone ?? "");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    startTransition(async () => {
      const result = await updateAdminPropertyAction({
        propertyId: property.id,
        bookingHorizonDays,
        maxConcurrentGroups,
        tagline: tagline.trim() || null,
        supportEmail: supportEmail.trim() || null,
        supportPhone: supportPhone.trim() || null,
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }

      setSavedAt(Date.now());
      router.refresh();
    });
  };

  return (
    <Card padding="loose" elevation="soft" className={s.section}>
      <div className={s.sectionTitle}>
        <PropertyPill name={property.name} slug={property.slug} withDot />
      </div>

      <form onSubmit={handleSubmit} className={s.form}>
        {error && (
          <Alert variant="error" title="Couldn't save">
            {error}
          </Alert>
        )}
        {savedAt && !error && (
          <Alert variant="success" title="Saved">
            Changes applied.
          </Alert>
        )}

        <div className={s.row}>
          <label className={s.field}>
            <span className={s.label}>Horizon (days)</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="365"
              step="1"
              value={bookingHorizonDays}
              onChange={(e) => setBookingHorizonDays(e.target.value)}
              className={s.input}
              required
            />
            <span className={s.help}>How far ahead guests can book. 1–365.</span>
          </label>

          <label className={s.field}>
            <span className={s.label}>Max concurrent groups</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={maxConcurrentGroups}
              onChange={(e) => setMaxConcurrentGroups(e.target.value)}
              className={s.input}
              required
            />
            <span className={s.help}>Capacity ceiling.</span>
          </label>
        </div>

        <label className={s.field}>
          <span className={s.label}>Tagline</span>
          <textarea
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={s.textarea}
            maxLength={500}
            rows={2}
            placeholder="One sentence shown on the umbrella home page."
          />
          <span className={s.help}>
            Shown on the home page card. Blank hides it.
          </span>
        </label>

        <div className={s.row}>
          <label className={s.field}>
            <span className={s.label}>Support email</span>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className={s.input}
              placeholder="hello@example.com"
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Support phone</span>
            <input
              type="tel"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              className={s.input}
              placeholder="(555) 555-5555"
            />
          </label>
        </div>
        <span className={s.help} style={{ marginTop: "calc(-1 * var(--space-2))" }}>
          Support contact — saved but not yet displayed to guests.
        </span>

        <div className={s.actions}>
          <Button asChild variant="secondary">
            <Link href={`/admin/properties/${property.id}/catalog`}>
              Manage catalog →
            </Link>
          </Button>
          <Button type="submit" variant="primary" loading={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
