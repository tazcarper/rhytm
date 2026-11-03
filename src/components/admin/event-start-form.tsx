"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { saveEventAction, saveEventExtrasAction } from "@/app/admin/events/actions";
import { EVENT_TYPES, STANDING_EVENT_TYPE } from "@/src/constants/admin/event-types";
import type { EventStarter } from "@/src/constants/admin/event-starters";
import s from "./bid-editor-form.module.css";
import h from "./homepage-hero-form.module.css";

interface PropertyOption {
  id: string;
  name: string;
}

// The first step of a new event: only what's needed to start a draft
// (property, name, kind, when). Everything else gets a sensible default
// here, or the chosen starter's, and is filled in afterwards in the
// section builder on the event's own page.
export function EventStartForm({
  properties,
  defaultPropertyId,
  starter,
  starterPicker,
  footer,
}: {
  properties: ReadonlyArray<PropertyOption>;
  defaultPropertyId?: string;
  starter: EventStarter | null;
  // Slots: the optional starter chips above the fields, and the
  // copy-a-template line below them.
  starterPicker?: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? properties[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>(starter?.defaults.type ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [scheduleText, setScheduleText] = useState("");

  const isStanding = type === STANDING_EVENT_TYPE;

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await saveEventAction({
        propertyId,
        title: title.trim(),
        type: type || null,
        startAt: isStanding ? null : startAt || null,
        endAt: isStanding ? null : endAt || null,
        scheduleText: isStanding ? scheduleText.trim() || null : null,
        featured: false,
        includedWithMembership: false,
        audience: "members_and_public",
        maxCapacity: starter?.defaults.maxCapacity ?? 20,
        maxGuestsPerRegistration: starter?.defaults.maxGuestsPerRegistration ?? 4,
        status: "draft",
        isManuallySoldOut: false,
        isTemplate: false,
        infoBoxes: (starter?.defaults.infoBoxes ?? []).map((box, index) => ({
          boxType: "list" as const,
          heading: box.heading,
          body: null,
          items: [...box.items],
          sortOrder: index,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (starter) {
        const extras = await saveEventExtrasAction(result.id, starter.extras);
        if (!extras.ok) {
          setError(`The draft was saved, but not the starter's tickets and gear: ${extras.error}`);
          return;
        }
      }
      router.push(`/admin/events/${result.id}?started=1`);
    });
  };

  return (
    <Card padding="loose" elevation="soft" className="mb-6">
      <div className={h.formHead}>
        <h2 className={h.formTitle}>Start with the essentials</h2>
      </div>
      <p className={h.groupDesc}>
        Just four things to begin. It's saved as a draft that guests can't see, then you add prices, tickets and
        the rest one step at a time.
      </p>
      {starterPicker}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <Alert variant="error" title="Couldn't start the event">
            {error}
          </Alert>
        )}

        <div className={h.grid2}>
          <label className={s.field}>
            <span className={s.label}>Property</span>
            <select
              value={propertyId}
              onChange={(evt) => setPropertyId(evt.target.value)}
              className={s.input}
              required
            >
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            <span className={s.label}>Kind of event</span>
            <select value={type} onChange={(evt) => setType(evt.target.value)} className={s.input}>
              <option value="">Choose…</option>
              {EVENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={s.field}>
          <span className={s.label}>Event name</span>
          <input
            type="text"
            value={title}
            onChange={(evt) => setTitle(evt.target.value)}
            className={s.input}
            required
            placeholder="Mahjong Night"
          />
        </label>

        {isStanding ? (
          <label className={s.field}>
            <span className={s.label}>When it runs</span>
            <input
              type="text"
              value={scheduleText}
              onChange={(evt) => setScheduleText(evt.target.value)}
              className={s.input}
              required
              placeholder="e.g. Tuesday and Thursday 7:30 AM, Saturday 8:00 AM"
            />
          </label>
        ) : (
          <div className={h.grid2}>
            <label className={s.field}>
              <span className={s.label}>Starts</span>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(evt) => setStartAt(evt.target.value)}
                className={s.input}
                required
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Ends (optional)</span>
              <input
                type="datetime-local"
                value={endAt}
                min={startAt || undefined}
                onChange={(evt) => setEndAt(evt.target.value)}
                className={s.input}
              />
            </label>
          </div>
        )}

        <p className="text-micro text-gray">
          {isStanding
            ? "An ongoing programme has no set date. Guests see this schedule instead."
            : "Happens more than once, like every Wednesday? You'll add the other dates in the next step."}
        </p>

        <div className={h.actions}>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Starting…" : "Continue"}
          </Button>
        </div>
      </form>
      {footer}
    </Card>
  );
}
