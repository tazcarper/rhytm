"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import {
  saveEventAction,
  saveRecurringEventsAction,
  copyEventToDatesAction,
  deleteEventAction,
  saveEventExtrasAction,
} from "@/app/admin/events/actions";
import {
  SaveEventExtrasSchema,
  type SaveEventExtrasInput,
} from "@/src/services/events/event-extras-contract";
import { EventExtrasFields, toEditableExtras, toExtrasInput } from "@/src/components/admin/event-extras-fields";
import type { AdminEventDetail, EventAudience, EventStatus } from "@/src/services/admin/events";
import type { AdminDisciplineOption, AdminInstructorRow } from "@/src/services/admin/instructors";
import { EVENT_TYPES, STANDING_EVENT_TYPE, eventTypeFields } from "@/src/constants/admin/event-types";
import { EventInfoBoxEditor, type EditableInfoBox } from "./event-info-box-editor";
import { EventImageInput } from "./event-image-input";
import { EventLivePreview, type EventPreviewData } from "./event-live-preview";
import { RecurringDatesEditor } from "./recurring-dates-editor";
import s from "./bid-editor-form.module.css";
import h from "./homepage-hero-form.module.css";

interface PropertyOption {
  id: string;
  name: string;
}

interface EventEditorFormProps {
  event: AdminEventDetail | null;
  properties: ReadonlyArray<PropertyOption>;
  disciplineOptions: ReadonlyArray<AdminDisciplineOption>;
  instructorOptions: ReadonlyArray<AdminInstructorRow>;
  // Pre-selects the property on a brand-new event (e.g. the "Add event"
  // shortcut from a property's Marketing pages > Events tab). Ignored once
  // an existing event is loaded — its own propertyId always wins.
  defaultPropertyId?: string;
  // Pre-fills a brand-new event from a built-in starter (see
  // src/constants/admin/event-starters.ts). Ignored once an existing event
  // is loaded.
  seed?: EventFormSeed;
  // Tickets, gear and questions: saved ones for an existing event, or a
  // starter's defaults for a new one. Saved with the rest of the event.
  extras: SaveEventExtrasInput;
  // Shown under the Tickets heading when `extras` came from a starter.
  extrasNote?: string;
}

// The subset of an event a starter can pre-fill. No id — a seeded form is
// still a create, not an edit.
export type EventFormSeed = Partial<Omit<AdminEventDetail, "id" | "infoBoxes">> & {
  infoBoxes?: ReadonlyArray<{ heading: string; items: ReadonlyArray<string> }>;
};

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

function seedToEditableBoxes(seed: EventFormSeed | undefined): EditableInfoBox[] {
  return (seed?.infoBoxes ?? []).map((box, index) => ({
    key: `seed-${index}`,
    boxType: "list",
    heading: box.heading,
    body: "",
    items: box.items.length > 0 ? [...box.items] : [""],
  }));
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

// A <select> sourced from real domain options, with a "— Custom —" escape
// hatch that reveals a text input — so a value already stored that doesn't
// match the current option set (a renamed/removed instructor or discipline,
// or a hand-typed legacy value) never gets silently discarded on save. Same
// precedent as InstructorPhotoInput's URL-paste fallback.
function SelectWithCustomFallback({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabledReason,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<string>;
  onChange: (value: string) => void;
  placeholder: string;
  disabledReason?: string;
}) {
  const CUSTOM = "__custom__";
  const isKnown = value === "" || options.includes(value);
  const selectValue = isKnown ? value : CUSTOM;

  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      <select
        value={selectValue}
        onChange={(evt) => onChange(evt.target.value === CUSTOM ? "" : evt.target.value)}
        className={s.input}
        disabled={options.length === 0}
      >
        <option value="">{options.length === 0 ? (disabledReason ?? placeholder) : placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={CUSTOM}>— Custom —</option>
      </select>
      {selectValue === CUSTOM && (
        <input
          type="text"
          value={value}
          onChange={(evt) => onChange(evt.target.value)}
          className={s.input}
          placeholder="Type a value"
          style={{ marginTop: "0.5rem" }}
        />
      )}
    </label>
  );
}

function fmtDateLabel(wallClock: string): string {
  const datePart = wallClock.split("T")[0];
  if (!datePart) return "";
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[month - 1]} ${day}, ${year}`;
}

function fmtTimeLabel(wallClock: string): string {
  const timePart = wallClock.split("T")[1];
  if (!timePart) return "";
  const [hourStr, minute] = timePart.split(":");
  const hour = Number(hourStr);
  if (Number.isNaN(hour)) return "";
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${ampm}`;
}

// Full editor for one event (create or edit). Client component: local field
// state, thin Server Actions for save / delete, plus a nested info-box
// sub-editor and a live preview. Mirrors PromotionEditorForm's structure and
// styling.
export function EventEditorForm({
  event,
  properties,
  disciplineOptions,
  instructorOptions,
  defaultPropertyId,
  seed,
  extras,
  extrasNote,
}: EventEditorFormProps) {
  const initial = event ?? (seed ? { ...seed, infoBoxes: undefined } : null);
  const createdHref = (id: string) => `/admin/events/${id}`;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [propertyId, setPropertyId] = useState(
    initial?.propertyId ?? defaultPropertyId ?? properties[0]?.id ?? "",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startAt, setStartAt] = useState(toLocalInput(initial?.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(initial?.endAt));
  const [scheduleText, setScheduleText] = useState(initial?.scheduleText ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [instructors, setInstructors] = useState(initial?.instructors ?? "");
  const [type, setType] = useState(initial?.type ?? "");
  const [discipline, setDiscipline] = useState(initial?.discipline ?? "");
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [includedWithMembership, setIncludedWithMembership] = useState(
    initial?.includedWithMembership ?? false,
  );
  const [audience, setAudience] = useState<EventAudience>(initial?.audience ?? "members_and_public");
  const [maxCapacity, setMaxCapacity] = useState(String(initial?.maxCapacity ?? 20));
  const [maxGuestsPerRegistration, setMaxGuestsPerRegistration] = useState(
    String(initial?.maxGuestsPerRegistration ?? 4),
  );
  const [memberPrice, setMemberPrice] = useState(initial?.memberPrice != null ? String(initial.memberPrice) : "");
  const [nonMemberPrice, setNonMemberPrice] = useState(
    initial?.nonMemberPrice != null ? String(initial.nonMemberPrice) : "",
  );
  const [status, setStatus] = useState<EventStatus>(initial?.status ?? "draft");
  const [isManuallySoldOut, setIsManuallySoldOut] = useState(initial?.isManuallySoldOut ?? false);
  const [isTemplate, setIsTemplate] = useState(initial?.isTemplate ?? false);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [infoBoxes, setInfoBoxes] = useState<EditableInfoBox[]>(event ? toEditableBoxes(event) : seedToEditableBoxes(seed));
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [extrasState, setExtrasState] = useState(() => toEditableExtras(extras));
  // Bumped after copying to more dates, to reset the repeat picker.
  const [repeatPickerKey, setRepeatPickerKey] = useState(0);
  const [copiedCount, setCopiedCount] = useState(0);

  const isStanding = type === STANDING_EVENT_TYPE;
  const fields = eventTypeFields(type || null);
  const showInstructorFields = fields.instructor;
  const showDiscipline = fields.discipline;
  // Members-only events have no non-member price to quote.
  const showNonMemberPrice = audience !== "members_only";

  // Member price = 0 IS included-with-membership; both directions wired,
  // neither fires the other's handler, so there's no feedback loop — same
  // pattern the reference mockup uses.
  function handleMemberPriceChange(value: string) {
    setMemberPrice(value);
    const trimmed = value.trim();
    if (trimmed === "") return;
    const parsed = Number(trimmed);
    setIncludedWithMembership(!Number.isNaN(parsed) && parsed === 0);
  }
  function handleIncludedChange(checked: boolean) {
    setIncludedWithMembership(checked);
    if (checked) {
      setMemberPrice("0");
    } else if (memberPrice.trim() === "0") {
      setMemberPrice("");
    }
  }

  const disciplineOptionNames = useMemo(
    () =>
      [...new Set(disciplineOptions.filter((d) => d.propertyId === propertyId).map((d) => d.name))].sort(),
    [disciplineOptions, propertyId],
  );
  const instructorOptionNames = useMemo(
    () =>
      [
        ...new Set(
          instructorOptions
            .filter((i) => i.properties.some((p) => p.id === propertyId))
            .map((i) => i.name),
        ),
      ].sort(),
    [instructorOptions, propertyId],
  );

  const previewData: EventPreviewData = {
    title,
    type,
    discipline,
    featured,
    includedWithMembership,
    audience,
    dateLabel: isStanding ? scheduleText : fmtDateLabel(startAt),
    timeLabel: isStanding ? "" : [fmtTimeLabel(startAt), fmtTimeLabel(endAt)].filter(Boolean).join(" – "),
    location,
    instructors,
    capacityLabel: maxCapacity ? `${maxCapacity} spots` : "",
    imageUrl,
    description,
    expectItems: infoBoxes
      .filter((box) => box.heading.trim())
      .map((box) => ({
        heading: box.heading,
        items: box.boxType === "list" ? box.items.filter((item) => item.trim()) : [box.body].filter(Boolean),
      })),
    memberPrice: memberPrice.trim() ? `$${memberPrice}` : "",
    nonMemberPrice: showNonMemberPrice && nonMemberPrice.trim() ? `$${nonMemberPrice}` : "",
  };

  function buildPayload(overrideStartAt?: string) {
    return {
      id: event?.id,
      propertyId,
      title: title.trim(),
      summary: summary.trim() || null,
      description: description.trim() || null,
      startAt: isStanding ? null : (overrideStartAt ?? startAt) || null,
      scheduleText: isStanding ? scheduleText.trim() || null : null,
      endAt: isStanding ? null : endAt || null,
      location: location.trim() || null,
      instructors: instructors.trim() || null,
      type: type.trim() || null,
      discipline: showDiscipline ? discipline.trim() || null : null,
      featured,
      includedWithMembership,
      audience,
      maxCapacity: Number(maxCapacity) || 0,
      maxGuestsPerRegistration: Number(maxGuestsPerRegistration) || 0,
      memberPrice: memberPrice.trim() === "" ? null : Number(memberPrice),
      nonMemberPrice: !showNonMemberPrice || nonMemberPrice.trim() === "" ? null : Number(nonMemberPrice),
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
    };
  }

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setError(null);
    setSavedAt(null);
    setCopiedCount(0);

    // Check tickets, gear and questions before anything is written, so a bad
    // row never leaves the event saved without them.
    const extrasInput = SaveEventExtrasSchema.safeParse(toExtrasInput(extrasState));
    if (!extrasInput.success) {
      const issue = extrasInput.error.issues[0];
      setError(issue ? `Tickets, gear and questions: ${issue.message}` : "Check the tickets, gear and questions.");
      return;
    }

    const saveExtrasFor = async (ids: ReadonlyArray<string>) => {
      for (const id of ids) {
        const saved = await saveEventExtrasAction(id, extrasInput.data);
        if (!saved.ok) return saved.error;
      }
      return null;
    };

    startTransition(async () => {
      const payload = buildPayload();

      // Each date is its own event row with its own capacity and roster
      // (see saveRecurringEvents). A new event creates all of them at once;
      // an existing one saves itself, then copies onto the extra dates.
      if (!event && extraDates.length > 0 && !isStanding) {
        const result = await saveRecurringEventsAction(payload, extraDates);
        if (!result.ok) {
          setError(result.error ?? "Could not save.");
          return;
        }
        const extrasError = await saveExtrasFor(result.ids);
        if (extrasError) {
          setError(`The events were saved, but not their tickets, gear and questions: ${extrasError}`);
          return;
        }
        setSavedAt(Date.now());
        router.push(createdHref(result.ids[0]));
        return;
      }

      const result = await saveEventAction(payload);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      const extrasError = await saveExtrasFor([result.id]);
      if (extrasError) {
        setError(`The event was saved, but not its tickets, gear and questions: ${extrasError}`);
        return;
      }

      if (event && extraDates.length > 0 && !isStanding) {
        // Copies get this event's saved tickets, gear and questions.
        const copies = await copyEventToDatesAction(event.id, payload, extraDates);
        if (!copies.ok) {
          setError(`Saved this event, but copying failed after ${copies.createdIds.length} dates: ${copies.error}`);
          return;
        }
        setCopiedCount(copies.ids.length);
        setExtraDates([]);
        setRepeatPickerKey((key) => key + 1);
      }

      setSavedAt(Date.now());
      if (!event) {
        router.push(createdHref(result.id));
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
    <div className="grid gap-6 lg:grid-cols-2 items-start">
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
              {copiedCount > 0
                ? `The event has been saved and copied to ${copiedCount} more ${copiedCount === 1 ? "date" : "dates"}.`
                : "The event has been saved."}
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
          </Group>

          <Group
            eyebrow="Classification"
            desc="Used to filter the public events calendar. Keep names consistent (always “Shotgun”, not sometimes “Shotguns”)."
          >
            <div className={h.grid2}>
              <label className={s.field}>
                <span className={s.label}>Type</span>
                <select value={type} onChange={(evt) => setType(evt.target.value)} className={s.input}>
                  <option value="">Select…</option>
                  {EVENT_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              {showDiscipline && (
                <SelectWithCustomFallback
                  label="Discipline"
                  value={discipline}
                  options={disciplineOptionNames}
                  onChange={setDiscipline}
                  placeholder="Select…"
                  disabledReason="No disciplines set up for this property yet"
                />
              )}
            </div>
            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={featured} onChange={(evt) => setFeatured(evt.target.checked)} />
              <span className="text-[14px] text-olive">
                Feature this event (gets the large callout card at the top of the calendar)
              </span>
            </label>
          </Group>

          <Group
            eyebrow="Date & time"
            desc={
              isStanding
                ? "A Standing programme runs indefinitely, so it has no date — it shows once on the calendar with this schedule instead."
                : "When the event happens. End time is optional."
            }
          >
            {isStanding ? (
              <label className={s.field}>
                <span className={s.label}>Schedule</span>
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
              <>
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
                <RecurringDatesEditor
                  key={repeatPickerKey}
                  startDate={startAt.split("T")[0] ?? ""}
                  extraDates={extraDates}
                  onChange={setExtraDates}
                  toggleLabel={event ? "Copy this event to more dates" : "Repeat this event on more dates"}
                />
              </>
            )}
          </Group>

          {showInstructorFields && (
            <Group eyebrow="Instructor" desc="Who's running this session, sourced from the property's roster.">
              <SelectWithCustomFallback
                label="Instructor"
                value={instructors}
                options={instructorOptionNames}
                onChange={setInstructors}
                placeholder="Select…"
                disabledReason="No instructors set up for this property yet"
              />
            </Group>
          )}

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
                  onChange={(evt) => handleMemberPriceChange(evt.target.value)}
                  className={s.input}
                  placeholder="Leave blank if free"
                />
              </label>
              {showNonMemberPrice && (
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
              )}
            </div>
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={includedWithMembership}
                onChange={(evt) => handleIncludedChange(evt.target.checked)}
              />
              <span className="text-[14px] text-olive">
                Included with membership (free to members — sets member price to $0)
              </span>
            </label>
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

          <Group
            eyebrow="Tickets, gear and questions"
            desc={`Ticket types guests choose from, the gear they need, and questions asked at sign-up.${extrasNote ? ` ${extrasNote}` : ""}`}
          >
            <EventExtrasFields value={extrasState} onChange={setExtrasState} />
          </Group>

          <Group eyebrow="Who can attend" desc="Informational only — every event stays open to anyone at registration; this just labels the event.">
            <label className={s.field}>
              <span className={s.label}>Audience</span>
              <select
                value={audience}
                onChange={(evt) => setAudience(evt.target.value as EventAudience)}
                className={s.input}
              >
                <option value="members_and_public">Members & public</option>
                <option value="members_only">Members only</option>
              </select>
            </label>
          </Group>

          <Group eyebrow="Image" desc="Optional. Shown on the listing card and detail page.">
            <EventImageInput value={imageUrl} onChange={setImageUrl} />
          </Group>

          <Group
            eyebrow="Info boxes"
            desc="Extra content blocks for the detail page — 'What to expect', 'Required gear', and similar. Description boxes are prose; list boxes are bullets."
          >
            <div className="flex gap-2 mb-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setInfoBoxes([
                    ...infoBoxes,
                    { key: crypto.randomUUID(), boxType: "list", heading: "What to Expect", body: "", items: [""] },
                  ])
                }
              >
                + What to expect
              </Button>
            </div>
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
                {/* Closing states only make sense once the event exists. */}
                {event && (
                  <>
                    <option value="sold_out">Sold out</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="completed">Completed</option>
                  </>
                )}
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
              {isPending
                ? "Saving…"
                : extraDates.length === 0
                  ? "Save event"
                  : event
                    ? `Save and copy to ${extraDates.length} ${extraDates.length === 1 ? "date" : "dates"}`
                    : `Save ${extraDates.length + 1} events`}
            </Button>
            {event && (
              <Button type="button" variant="ghost" disabled={isPending} onClick={handleDelete}>
                Delete
              </Button>
            )}
          </div>
        </form>
      </Card>

      <EventLivePreview event={previewData} />
    </div>
  );
}

// `.field`/`.grid2` (bid-editor-form.module.css / homepage-hero-form.module.css)
// carry no margin of their own — by design, since both classes are shared
// across a couple dozen admin forms with wildly different wrapping contexts,
// several of which already supply their own gap and would double up if the
// shared classes carried spacing. So the vertical rhythm between a group's
// stacked rows (fields, grid2 pairs, checkbox rows) is this component's own
// job, scoped locally to the event editor rather than touched globally.
function Group({ eyebrow, desc, children }: { eyebrow: string; desc: string; children: ReactNode }) {
  return (
    <section className={h.group}>
      <p className={h.groupEyebrow}>{eyebrow}</p>
      <p className={h.groupDesc}>{desc}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
