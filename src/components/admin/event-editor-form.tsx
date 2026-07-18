"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { saveEventAction, deleteEventAction } from "@/app/admin/events/actions";
import type { AdminEventDetail, EventStatus } from "@/src/services/admin/events";
import { EventInfoBoxEditor, type EditableInfoBox } from "./event-info-box-editor";
import s from "./bid-editor-form.module.css";
import h from "./homepage-hero-form.module.css";

interface PropertyOption {
  id: string;
  name: string;
}

interface EventEditorFormProps {
  event: AdminEventDetail | null;
  properties: ReadonlyArray<PropertyOption>;
  // Pre-selects the property on a brand-new event (e.g. the "Add event"
  // shortcut from a property's Marketing pages > Events tab). Ignored once
  // an existing event is loaded — its own propertyId always wins.
  defaultPropertyId?: string;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function toEditableBoxes(event: AdminEventDetail | null): EditableInfoBox[] {
  if (!event) return [];
  return event.infoBoxes.map((box) => ({
    key: box.id,
    id: box.id,
    boxType: box.boxType,
    heading: box.heading,
    body: box.body ?? "",
    items: box.items && box.items.length > 0 ? box.items : [""],
  }));
}

// Full editor for one event (create or edit). Client component: local field
// state, thin Server Actions for save / delete, plus a nested info-box
// sub-editor. Mirrors PromotionEditorForm's structure and styling.
export function EventEditorForm({ event, properties, defaultPropertyId }: EventEditorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [propertyId, setPropertyId] = useState(
    event?.propertyId ?? defaultPropertyId ?? properties[0]?.id ?? "",
  );
  const [title, setTitle] = useState(event?.title ?? "");
  const [summary, setSummary] = useState(event?.summary ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startAt, setStartAt] = useState(toLocalInput(event?.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(event?.endAt));
  const [location, setLocation] = useState(event?.location ?? "");
  const [instructors, setInstructors] = useState(event?.instructors ?? "");
  const [type, setType] = useState(event?.type ?? "");
  const [discipline, setDiscipline] = useState(event?.discipline ?? "");
  const [featured, setFeatured] = useState(event?.featured ?? false);
  const [maxCapacity, setMaxCapacity] = useState(String(event?.maxCapacity ?? 20));
  const [maxGuestsPerRegistration, setMaxGuestsPerRegistration] = useState(
    String(event?.maxGuestsPerRegistration ?? 4),
  );
  const [memberPrice, setMemberPrice] = useState(event?.memberPrice != null ? String(event.memberPrice) : "");
  const [nonMemberPrice, setNonMemberPrice] = useState(
    event?.nonMemberPrice != null ? String(event.nonMemberPrice) : "",
  );
  const [status, setStatus] = useState<EventStatus>(event?.status ?? "draft");
  const [isManuallySoldOut, setIsManuallySoldOut] = useState(event?.isManuallySoldOut ?? false);
  const [isTemplate, setIsTemplate] = useState(event?.isTemplate ?? false);
  const [imageUrl, setImageUrl] = useState(event?.imageUrl ?? "");
  const [infoBoxes, setInfoBoxes] = useState<EditableInfoBox[]>(toEditableBoxes(event));

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setError(null);
    setSavedAt(null);

    startTransition(async () => {
      const result = await saveEventAction({
        id: event?.id,
        propertyId,
        title: title.trim(),
        summary: summary.trim() || null,
        description: description.trim() || null,
        startAt,
        endAt: endAt || null,
        location: location.trim() || null,
        instructors: instructors.trim() || null,
        type: type.trim() || null,
        discipline: discipline.trim() || null,
        featured,
        maxCapacity: Number(maxCapacity) || 0,
        maxGuestsPerRegistration: Number(maxGuestsPerRegistration) || 0,
        memberPrice: memberPrice.trim() === "" ? null : Number(memberPrice),
        nonMemberPrice: nonMemberPrice.trim() === "" ? null : Number(nonMemberPrice),
        status,
        isManuallySoldOut,
        isTemplate,
        imageUrl: imageUrl.trim() || null,
        infoBoxes: infoBoxes.map((box, index) => ({
          id: box.id,
          boxType: box.boxType,
          heading: box.heading.trim(),
          body: box.boxType === "description" ? box.body.trim() || null : null,
          items: box.boxType === "list" ? box.items.filter((item) => item.trim()) : null,
          sortOrder: index,
        })),
      });

      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }

      setSavedAt(Date.now());
      if (!event) {
        router.push(`/admin/events/${result.id}`);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!event) return;
    if (!confirm("Delete this event? This can't be undone.")) return;
    startTransition(async () => {
      const result = await deleteEventAction(event.id);
      if (!result.ok) {
        setError(result.error ?? "Could not delete.");
        return;
      }
      router.push("/admin/events");
    });
  };

  return (
    <Card padding="loose" elevation="soft">
      <div className={h.formHead}>
        <h2 className={h.formTitle}>{event ? "Edit event" : "New event"}</h2>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <Alert variant="error" title="Couldn't save">
            {error}
          </Alert>
        )}
        {savedAt && !error && (
          <Alert variant="success" title="Saved">
            The event has been saved.
          </Alert>
        )}

        <Group eyebrow="Basics" desc="What the event is called, where it's happening, and which property it belongs to.">
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
            <span className={s.label}>Title</span>
            <input
              type="text"
              value={title}
              onChange={(evt) => setTitle(evt.target.value)}
              className={s.input}
              required
              placeholder="Fall Clays Classic"
            />
          </label>
          <label className={s.field}>
            <span className={s.label}>Summary</span>
            <input
              type="text"
              value={summary}
              onChange={(evt) => setSummary(evt.target.value)}
              className={s.input}
              placeholder="Short blurb shown on the listing card"
            />
          </label>
          <label className={s.field}>
            <span className={s.label}>Description</span>
            <textarea
              value={description}
              onChange={(evt) => setDescription(evt.target.value)}
              className={s.input}
              rows={5}
            />
          </label>
          <label className={s.field}>
            <span className={s.label}>Location</span>
            <input
              type="text"
              value={location}
              onChange={(evt) => setLocation(evt.target.value)}
              className={s.input}
              placeholder="Main clubhouse"
            />
          </label>
          <label className={s.field}>
            <span className={s.label}>Instructors</span>
            <input
              type="text"
              value={instructors}
              onChange={(evt) => setInstructors(evt.target.value)}
              className={s.input}
              placeholder="Ben Morton"
            />
          </label>
        </Group>

        <Group
          eyebrow="Classification"
          desc="Powers the events calendar's Type/Discipline filter pills — a filter only appears once some event uses it, so any value works, but stay consistent (e.g. always “Shotgun”, not sometimes “Shotguns”)."
        >
          <div className={h.grid2}>
            <label className={s.field}>
              <span className={s.label}>Type</span>
              <input
                type="text"
                value={type}
                onChange={(evt) => setType(evt.target.value)}
                className={s.input}
                placeholder="Training"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Discipline</span>
              <input
                type="text"
                value={discipline}
                onChange={(evt) => setDiscipline(evt.target.value)}
                className={s.input}
                placeholder="Shotgun"
              />
            </label>
          </div>
          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={featured} onChange={(evt) => setFeatured(evt.target.checked)} />
            <span className="text-[14px] text-olive">
              Feature this event (gets the large callout card at the top of the calendar)
            </span>
          </label>
        </Group>

        <Group eyebrow="Date & time" desc="When the event happens. End time is optional.">
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
              <span className={s.label}>Ends</span>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(evt) => setEndAt(evt.target.value)}
                className={s.input}
              />
            </label>
          </div>
        </Group>

        <Group
          eyebrow="Capacity & pricing"
          desc="A hard cap on total registered guests, the most one registration can claim, and quoted prices for members vs. non-members. No payment is collected at registration — prices are informational."
        >
          <div className={h.grid2}>
            <label className={s.field}>
              <span className={s.label}>Max capacity</span>
              <input
                type="number"
                min={1}
                value={maxCapacity}
                onChange={(evt) => setMaxCapacity(evt.target.value)}
                className={s.input}
                required
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Max guests per registration</span>
              <input
                type="number"
                min={1}
                value={maxGuestsPerRegistration}
                onChange={(evt) => setMaxGuestsPerRegistration(evt.target.value)}
                className={s.input}
                required
              />
            </label>
          </div>
          <div className={h.grid2}>
            <label className={s.field}>
              <span className={s.label}>Member price</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={memberPrice}
                onChange={(evt) => setMemberPrice(evt.target.value)}
                className={s.input}
                placeholder="Leave blank if free"
              />
            </label>
            <label className={s.field}>
              <span className={s.label}>Non-member price</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={nonMemberPrice}
                onChange={(evt) => setNonMemberPrice(evt.target.value)}
                className={s.input}
                placeholder="Leave blank if free"
              />
            </label>
          </div>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={isManuallySoldOut}
              onChange={(evt) => setIsManuallySoldOut(evt.target.checked)}
            />
            <span className="text-[14px] text-olive">
              Force sold out (blocks new confirmed registrations even under capacity)
            </span>
          </label>
        </Group>

        <Group eyebrow="Image" desc="Optional. Shown on the listing card and detail page.">
          <label className={s.field}>
            <span className={s.label}>Image link (URL)</span>
            <input
              type="text"
              value={imageUrl}
              onChange={(evt) => setImageUrl(evt.target.value)}
              className={s.input}
              placeholder="https://…/event.jpg"
            />
          </label>
        </Group>

        <Group
          eyebrow="Info boxes"
          desc="Extra content blocks for the detail page — 'What to expect', 'Required gear', and similar. Description boxes are prose; list boxes are bullets."
        >
          <EventInfoBoxEditor boxes={infoBoxes} onChange={setInfoBoxes} />
        </Group>

        <Group eyebrow="Status" desc="Draft is hidden from the public. Published is open for registration. Sold out / cancelled / completed are shown to the public but closed for new registrations.">
          <label className={s.field}>
            <span className={s.label}>Status</span>
            <select
              value={status}
              onChange={(evt) => setStatus(evt.target.value as EventStatus)}
              className={s.input}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="sold_out">Sold out</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={(evt) => setIsTemplate(evt.target.checked)}
            />
            <span className="text-[14px] text-olive">
              Save as a reusable template (hidden from the public; usable via &quot;New from template&quot;)
            </span>
          </label>
        </Group>

        <div className={h.actions}>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Saving…" : "Save event"}
          </Button>
          {event && (
            <Button type="button" variant="ghost" disabled={isPending} onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function Group({ eyebrow, desc, children }: { eyebrow: string; desc: string; children: ReactNode }) {
  return (
    <section className={h.group}>
      <p className={h.groupEyebrow}>{eyebrow}</p>
      <p className={h.groupDesc}>{desc}</p>
      {children}
    </section>
  );
}
