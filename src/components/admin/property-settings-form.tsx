"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { updateAdminPropertyAction } from "@/app/admin/properties/actions";
import type { AdminProperty } from "@/src/services/admin/properties";
import s from "./bid-editor-form.module.css";
import p from "./properties-admin.module.css";

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
  const [directions, setDirections] = useState(property.directions ?? "");
  const [parking, setParking] = useState(property.parking ?? "");
  const [arrivalContact, setArrivalContact] = useState(
    property.arrivalContact ?? "",
  );
  const [mapUrl, setMapUrl] = useState(property.mapUrl ?? "");
  const [notificationEmail, setNotificationEmail] = useState(
    property.notificationEmail ?? "",
  );

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
        directions: directions.trim() || null,
        parking: parking.trim() || null,
        arrivalContact: arrivalContact.trim() || null,
        mapUrl: mapUrl.trim() || null,
        notificationEmail: notificationEmail.trim() || null,
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
    <Card padding="loose" elevation="soft">
      <div className={p.formHead}>
        <h2 className={p.formTitle}>{property.name}</h2>
        <Button asChild variant="primary" size="md">
          <Link href={`/admin/properties/${property.id}/catalog`}>Manage catalog →</Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
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

        <Group
          eyebrow="Booking rules"
          desc="How far ahead guests can book, and how many groups can be on the property at once."
        >
          <div className={p.grid2}>
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
        </Group>

        <Group
          eyebrow="On the home page"
          desc="Shown on this property's card on the public home page. Blank hides it."
        >
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
          </label>
        </Group>

        <Group eyebrow="Notifications" desc="Where this property's new-booking alerts are sent.">
          <label className={s.field}>
            <span className={s.label}>Booking-alert email</span>
            <input
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              className={s.input}
              placeholder="bookings@example.com"
            />
            <span className={s.help}>
              Staff inbox that gets a “new booking request — review needed” email. Blank turns the
              alert off.
            </span>
          </label>
        </Group>

        <Group eyebrow="Support contact" desc="Saved for reference — not yet shown to guests.">
          <div className={p.grid2}>
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
        </Group>

        <Group
          eyebrow="Pre-visit details"
          desc="Included in the reminder emails guests get before their visit. Any blank field is simply left out."
        >
          <label className={s.field}>
            <span className={s.label}>Google Maps link</span>
            <input
              type="url"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              className={s.input}
              maxLength={2000}
              placeholder="https://maps.app.goo.gl/…"
            />
            <span className={s.help}>
              Paste the Share link from Google Maps. Shown as “Open in Google Maps” in pre-event
              emails.
            </span>
          </label>
          <label className={s.field}>
            <span className={s.label}>Directions</span>
            <textarea
              value={directions}
              onChange={(e) => setDirections(e.target.value)}
              className={s.textarea}
              maxLength={2000}
              rows={3}
              placeholder="How to get here — address, landmarks, gate code."
            />
            <span className={s.help}>Sent in the early pre-event reminder.</span>
          </label>
          <label className={s.field}>
            <span className={s.label}>Parking</span>
            <textarea
              value={parking}
              onChange={(e) => setParking(e.target.value)}
              className={s.textarea}
              maxLength={2000}
              rows={2}
              placeholder="Where to park and where to go from there."
            />
            <span className={s.help}>Sent a few days before the visit.</span>
          </label>
          <label className={s.field}>
            <span className={s.label}>Arrival contact</span>
            <input
              type="text"
              value={arrivalContact}
              onChange={(e) => setArrivalContact(e.target.value)}
              className={s.input}
              maxLength={500}
              placeholder="Who to ask for on the day — e.g. “Ask for Cody at the lodge.”"
            />
            <span className={s.help}>Sent in the day-before reminder.</span>
          </label>
        </Group>

        <div className={p.saveBar}>
          <Button type="submit" variant="primary" loading={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
          {savedAt && !error && <span className={p.savedNote}>Saved.</span>}
        </div>
      </form>
    </Card>
  );
}

function Group({
  eyebrow,
  desc,
  children,
}: {
  eyebrow: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <div className={p.group}>
      <div className={p.groupEyebrow}>{eyebrow}</div>
      {desc && <p className={p.groupDesc}>{desc}</p>}
      <div className={p.groupBody}>{children}</div>
    </div>
  );
}
