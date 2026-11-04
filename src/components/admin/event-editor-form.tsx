"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/lib/ui";
import { FlowButton as Button } from "./event-flow-button";
import {
  saveEventAction,
  copyEventToDatesAction,
  deleteEventAction,
  saveEventExtrasAction,
} from "@/app/admin/events/actions";
import {
  SaveEventExtrasSchema,
  type SaveEventExtrasInput,
} from "@/src/services/events/event-extras-contract";
import { EventExtrasFields, toEditableExtras, toExtrasInput } from "@/src/components/admin/event-extras-fields";
import { GearPicker } from "@/src/components/admin/gear-picker";
import type { GearPreset } from "@/src/services/admin/gear-presets";
import type { AdminEventDetail, EventAudience, EventStatus } from "@/src/services/admin/events";
import type { AdminDisciplineOption, AdminInstructorRow } from "@/src/services/admin/instructors";
import { EVENT_TYPES, STANDING_EVENT_TYPE, eventTypeFields } from "@/src/constants/admin/event-types";
import {
  EVENT_BUILDER_SECTIONS,
  checkEventForm,
  firstSectionWithProblems,
  sectionFromStepSlug,
  stepSlug,
  sectionStatus,
  type EventBuilderSection,
  type SectionStatus,
} from "@/src/services/admin/event-form-check";
import { EventInfoBoxEditor, type EditableInfoBox } from "./event-info-box-editor";
import { EventImageInput } from "./event-image-input";
import { EventLivePreview, type EventPreviewData } from "./event-live-preview";
import { RecurringDatesEditor } from "./recurring-dates-editor";
import s from "./event-flow.module.css";
import h from "./event-flow.module.css";

interface PropertyOption {
  id: string;
  name: string;
}

interface EventEditorFormProps {
  event: AdminEventDetail;
  properties: ReadonlyArray<PropertyOption>;
  disciplineOptions: ReadonlyArray<AdminDisciplineOption>;
  instructorOptions: ReadonlyArray<AdminInstructorRow>;
  // Tickets, gear and questions already saved for the event. Saved with the
  // rest of the event.
  extras: SaveEventExtrasInput;
  // Saved gear lists for the properties the admin can see; the Gear step
  // shows the chosen property's list as a quick-add checklist.
  gearPresets: ReadonlyArray<GearPreset>;
  // True right after the start screen created this draft: shows a short
  // "here's what's next" note.
  justStarted?: boolean;
  // The step to open first, from the page address (?step=…).
  initialStep?: EventBuilderSection;
}

const SECTION_COPY: Record<EventBuilderSection, { label: string; desc: string }> = {
  basics: {
    label: "Basics",
    desc: "The name, the kind of event, and where it happens.",
  },
  when: {
    label: "Date and time",
    desc: "When it happens, and any other dates it runs on.",
  },
  spots: {
    label: "Spots and prices",
    desc: "How many people can come, the ticket options they pick from, and what it costs. Guests don't pay when they sign up; prices are shown so they know what to expect.",
  },
  guests: {
    label: "Gear and questions",
    desc: "Optional. The gear guests need, and anything to ask them when they sign up.",
  },
  page: {
    label: "Photo and extras",
    desc: "Optional. A photo for the event card, more sections for the event page, and whether to feature it.",
  },
  review: {
    label: "Review and publish",
    desc: "Check everything at a glance, then publish when it's ready for guests.",
  },
};

const STATUS_LABEL: Record<SectionStatus, string> = {
  done: "Done",
  needs_attention: "Needs attention",
  optional: "Optional",
};

const STATUS_CLASS: Record<SectionStatus, string> = {
  done: "text-olive",
  needs_attention: "text-accent-error font-semibold",
  optional: "text-gray",
};

const STATUS_MARK: Record<SectionStatus, string> = {
  done: "✓",
  needs_attention: "!",
  optional: "○",
};

const STEP_NUMBER_CLASS: Record<SectionStatus, string> = {
  done: h.stepNumberDone,
  needs_attention: h.stepNumberProblem,
  optional: h.stepNumberOptional,
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

function toEditableBoxes(event: AdminEventDetail): EditableInfoBox[] {
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
        <option value={CUSTOM}>Something else…</option>
      </select>
      {selectValue === CUSTOM && (
        <input
          type="text"
          value={value}
          onChange={(evt) => onChange(evt.target.value)}
          className={s.input}
          placeholder="Type it in"
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

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// The event builder: one section at a time, with a list of sections that
// shows which are done and which need attention, and a live preview
// alongside. Every section stays mounted (only the active one is shown), so
// switching sections never loses typing, and one Save writes the whole
// event. Thin Server Actions do the saving; checkEventForm decides what's
// missing.
export function EventEditorForm({
  event,
  properties,
  disciplineOptions,
  instructorOptions,
  extras,
  gearPresets,
  justStarted = false,
  initialStep = "basics",
}: EventEditorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showStartedNote, setShowStartedNote] = useState(justStarted);
  const [active, setActive] = useState<EventBuilderSection>(initialStep);

  // Mirror the open step into the address bar (?step=…) without reloading,
  // so a step can be linked to and Back/Forward move between steps.
  function goToStep(section: EventBuilderSection) {
    setActive(section);
    const url = new URL(window.location.href);
    if (url.searchParams.get("step") === stepSlug(section)) return;
    url.searchParams.set("step", stepSlug(section));
    url.searchParams.delete("started");
    window.history.pushState(null, "", url);
  }
  useEffect(() => {
    const onPopState = () => {
      const section = sectionFromStepSlug(new URL(window.location.href).searchParams.get("step"));
      setActive(section ?? "basics");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [propertyId, setPropertyId] = useState(event.propertyId);
  const [title, setTitle] = useState(event.title);
  const [summary, setSummary] = useState(event.summary ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [startAt, setStartAt] = useState(toLocalInput(event.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(event.endAt));
  const [scheduleText, setScheduleText] = useState(event.scheduleText ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [instructors, setInstructors] = useState(event.instructors ?? "");
  const [type, setType] = useState(event.type ?? "");
  const [discipline, setDiscipline] = useState(event.discipline ?? "");
  const [featured, setFeatured] = useState(event.featured);
  const [includedWithMembership, setIncludedWithMembership] = useState(event.includedWithMembership);
  const [audience, setAudience] = useState<EventAudience>(event.audience);
  const [maxCapacity, setMaxCapacity] = useState(String(event.maxCapacity));
  const [maxGuestsPerRegistration, setMaxGuestsPerRegistration] = useState(String(event.maxGuestsPerRegistration));
  const [memberPrice, setMemberPrice] = useState(event.memberPrice != null ? String(event.memberPrice) : "");
  const [nonMemberPrice, setNonMemberPrice] = useState(event.nonMemberPrice != null ? String(event.nonMemberPrice) : "");
  const [status, setStatus] = useState<EventStatus>(event.status);
  const [isManuallySoldOut, setIsManuallySoldOut] = useState(event.isManuallySoldOut);
  const [isTemplate, setIsTemplate] = useState(event.isTemplate);
  const [imageUrl, setImageUrl] = useState(event.imageUrl ?? "");
  const [infoBoxes, setInfoBoxes] = useState<EditableInfoBox[]>(() => toEditableBoxes(event));
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

  const checkInput = {
    title,
    propertyId,
    isStanding,
    startAt,
    endAt,
    scheduleText,
    maxCapacity,
    maxGuestsPerRegistration,
    ticketNames: extrasState.tickets.map((ticket) => ticket.name),
    gearNames: extrasState.gear.map((item) => item.name),
    questionLabels: extrasState.questions.map((question) => question.label),
    hasPageExtras: Boolean(imageUrl.trim()) || infoBoxes.length > 0 || featured,
  };
  const problems = checkEventForm(checkInput);
  const statusOf = (section: EventBuilderSection) => sectionStatus(section, problems, checkInput);
  const allProblems = EVENT_BUILDER_SECTIONS.flatMap((section) =>
    problems[section].map((message) => ({ section, message })),
  );

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

  const dateLabel = isStanding ? scheduleText : fmtDateLabel(startAt);
  const timeLabel = isStanding ? "" : [fmtTimeLabel(startAt), fmtTimeLabel(endAt)].filter(Boolean).join(" – ");

  const namedTickets = extrasState.tickets.filter((ticket) => ticket.name.trim());
  const previewPrices: EventPreviewData["prices"] =
    namedTickets.length > 0
      ? namedTickets.map((ticket) => ({
          label: ticket.name.trim(),
          value: !ticket.price.trim() ? "Price not set" : Number(ticket.price) === 0 ? "Free" : `$${ticket.price.trim()}`,
          note: ticket.description.trim(),
        }))
      : [
          memberPrice.trim() ? { label: "Member", value: `$${memberPrice.trim()}`, note: "" } : null,
          showNonMemberPrice && nonMemberPrice.trim()
            ? { label: "Non-member", value: `$${nonMemberPrice.trim()}`, note: "" }
            : null,
        ].filter((price) => price !== null);

  const previewData: EventPreviewData = {
    title,
    type,
    discipline: showDiscipline ? discipline : "",
    featured,
    includedWithMembership,
    audience,
    dateLabel,
    timeLabel,
    location,
    instructors: showInstructorFields ? instructors : "",
    capacityLabel: maxCapacity ? `${maxCapacity} spots` : "",
    imageUrl,
    description,
    expectItems: infoBoxes
      .filter((box) => box.heading.trim())
      .map((box) => ({
        heading: box.heading,
        items: box.boxType === "list" ? box.items.filter((item) => item.trim()) : [box.body].filter(Boolean),
      })),
    prices: previewPrices,
  };

  function buildPayload(statusOverride?: EventStatus) {
    return {
      id: event.id,
      propertyId,
      title: title.trim(),
      summary: summary.trim() || null,
      description: description.trim() || null,
      startAt: isStanding ? null : startAt || null,
      scheduleText: isStanding ? scheduleText.trim() || null : null,
      endAt: isStanding ? null : endAt || null,
      location: location.trim() || null,
      instructors: showInstructorFields ? instructors.trim() || null : null,
      type: type.trim() || null,
      discipline: showDiscipline ? discipline.trim() || null : null,
      featured,
      includedWithMembership,
      audience,
      maxCapacity: Number(maxCapacity) || 0,
      maxGuestsPerRegistration: Number(maxGuestsPerRegistration) || 0,
      memberPrice: memberPrice.trim() === "" ? null : Number(memberPrice),
      nonMemberPrice: !showNonMemberPrice || nonMemberPrice.trim() === "" ? null : Number(nonMemberPrice),
      status: statusOverride ?? status,
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

  // Saves the whole event (every section), then runs `onSaved`.
  function save({ statusOverride, onSaved }: { statusOverride?: EventStatus; onSaved?: () => void } = {}) {
    setError(null);
    setSavedAt(null);
    setCopiedCount(0);
    setShowStartedNote(false);

    const firstProblem = firstSectionWithProblems(problems);
    if (firstProblem) {
      setError(`${SECTION_COPY[firstProblem].label}: ${problems[firstProblem][0]}`);
      goToStep(firstProblem);
      return;
    }

    // Check tickets, gear and questions before anything is written, so a bad
    // row never leaves the event saved without them.
    const extrasInput = SaveEventExtrasSchema.safeParse(toExtrasInput(extrasState));
    if (!extrasInput.success) {
      const issue = extrasInput.error.issues[0];
      setError(issue ? `Tickets, gear and questions: ${issue.message}` : "Check the tickets, gear and questions.");
      return;
    }

    startTransition(async () => {
      const payload = buildPayload(statusOverride);
      const result = await saveEventAction(payload);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      const saved = await saveEventExtrasAction(event.id, extrasInput.data);
      if (!saved.ok) {
        setError(`The event was saved, but not its tickets, gear and questions: ${saved.error}`);
        return;
      }

      // Each extra date is its own event row with its own spots and sign-ups
      // (see saveRecurringEvents); copies get this event's tickets, gear and
      // questions.
      if (extraDates.length > 0 && !isStanding) {
        const copies = await copyEventToDatesAction(event.id, payload, extraDates);
        if (!copies.ok) {
          setError(`Saved this event, but copying failed after ${copies.createdIds.length} dates: ${copies.error}`);
          return;
        }
        setCopiedCount(copies.ids.length);
        setExtraDates([]);
        setRepeatPickerKey((key) => key + 1);
      }

      if (statusOverride) setStatus(statusOverride);
      setSavedAt(Date.now());
      onSaved?.();
      router.refresh();
    });
  }

  const goNext = () => {
    const index = EVENT_BUILDER_SECTIONS.indexOf(active);
    const next = EVENT_BUILDER_SECTIONS[index + 1];
    if (next) goToStep(next);
  };
  const goBack = () => {
    const index = EVENT_BUILDER_SECTIONS.indexOf(active);
    const previous = EVENT_BUILDER_SECTIONS[index - 1];
    if (previous) goToStep(previous);
  };

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    save({ onSaved: active === "review" ? undefined : goNext });
  };

  const handleDelete = () => {
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

  const { tickets, gear, questions } = extrasState;
  const summaries: Record<Exclude<EventBuilderSection, "review">, string> = {
    basics: [title, type, showDiscipline ? discipline : "", location].filter(Boolean).join(" · "),
    when:
      [dateLabel, timeLabel].filter(Boolean).join(", ") +
      (extraDates.length > 0 ? `, plus ${plural(extraDates.length, "more date", "more dates")} on save` : ""),
    spots: [
      maxCapacity ? `${maxCapacity} spots` : "",
      tickets.length > 0 ? plural(tickets.length, "ticket option", "ticket options") : "",
      memberPrice.trim() ? `members $${memberPrice}` : "",
      showNonMemberPrice && nonMemberPrice.trim() ? `others $${nonMemberPrice}` : "",
      audience === "members_only" ? "members only" : "",
    ]
      .filter(Boolean)
      .join(" · "),
    guests:
      gear.length + questions.length === 0
        ? "None added"
        : [
            gear.length > 0 ? plural(gear.length, "gear item", "gear items") : "",
            questions.length > 0 ? plural(questions.length, "question", "questions") : "",
          ]
            .filter(Boolean)
            .join(" · "),
    page:
      [
        imageUrl.trim() ? "Photo" : "",
        infoBoxes.length > 0 ? plural(infoBoxes.length, "extra section", "extra sections") : "",
        featured ? "Featured" : "",
      ]
        .filter(Boolean)
        .join(" · ") || "None added",
  };

  const isLast = active === "review";
  const activeIndex = EVENT_BUILDER_SECTIONS.indexOf(active);
  const canPublish = status === "draft" && allProblems.length === 0;

  return (
    <div className={`${h.flow} grid gap-8 2xl:grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)] items-start`}>
      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] items-start">
        {/* Step list: a column on wide screens, a dropdown on phones. */}
        <nav aria-label="Event steps" className="hidden lg:block">
          <ol className="flex flex-col gap-1.5">
            {EVENT_BUILDER_SECTIONS.map((section, index) => {
              const sectionState = statusOf(section);
              const isActive = section === active;
              const numberClass = isActive
                ? h.stepNumberActive
                : section === "review"
                  ? ""
                  : STEP_NUMBER_CLASS[sectionState];
              return (
                <li key={section}>
                  <button
                    type="button"
                    onClick={() => goToStep(section)}
                    aria-current={isActive ? "step" : undefined}
                    className={`${h.step} ${isActive ? h.stepActive : ""}`}
                  >
                    <span className={`${h.stepNumber} ${numberClass}`} aria-hidden="true">
                      {!isActive && sectionState === "done" && section !== "review" ? "✓" : index + 1}
                    </span>
                    <span>
                      <span className={h.stepLabel}>{SECTION_COPY[section].label}</span>
                      {section !== "review" && (
                        <span className={`${h.stepStatus} ${STATUS_CLASS[sectionState]}`}>
                          {STATUS_LABEL[sectionState]}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        {/* Wrapper carries lg:hidden: .field sets its own display. */}
        <div className="lg:hidden">
          <label className={s.field}>
            <span className={s.label}>Step</span>
            <select
              value={active}
              onChange={(evt) => goToStep(evt.target.value as EventBuilderSection)}
              className={s.input}
            >
              {EVENT_BUILDER_SECTIONS.map((section, index) => (
                <option key={section} value={section}>
                  {index + 1}. {SECTION_COPY[section].label}
                  {section !== "review" ? ` (${STATUS_LABEL[statusOf(section)]})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={h.panel}>
          <div className="mb-6 flex flex-col gap-2">
            <div className={`flex items-center justify-between ${h.eyebrow}`}>
              <span>
                Step {activeIndex + 1} of {EVENT_BUILDER_SECTIONS.length}
              </span>
              <span>{status === "draft" ? "Draft: guests can't see it yet" : null}</span>
            </div>
            <div className={h.progress} aria-hidden="true">
              <div
                className={h.progressFill}
                style={{ width: `${((activeIndex + 1) / EVENT_BUILDER_SECTIONS.length) * 100}%` }}
              />
            </div>
          </div>
          <div className={h.formHead}>
            <h2 className={h.formTitle}>{SECTION_COPY[active].label}</h2>
          </div>

          {/* noValidate: hidden sections can't show the browser's own
              warnings, so checkEventForm does the checking instead. */}
          <form onSubmit={handleSubmit} noValidate>
            {showStartedNote && (
              <Alert variant="info" title="Your draft is saved">
                Guests can't see it yet. Work through the steps on the left (or skip the optional ones), then
                publish from Review and publish.
              </Alert>
            )}
            {error && (
              <Alert variant="error" title="Couldn't save">
                {error}
              </Alert>
            )}
            {savedAt && !error && (
              <Alert variant="success" title="Saved">
                {copiedCount > 0
                  ? `The event has been saved and copied to ${plural(copiedCount, "more date", "more dates")}.`
                  : "The event has been saved."}
              </Alert>
            )}

            <p className={h.groupDesc}>{SECTION_COPY[active].desc}</p>

            <div hidden={active !== "basics"} className="flex flex-col gap-7">
              <label className={s.field}>
                <span className={s.label}>Event name</span>
                <input
                  type="text"
                  value={title}
                  onChange={(evt) => setTitle(evt.target.value)}
                  className={s.input}
                  placeholder="Fall Clays Classic"
                />
              </label>
              <div className={h.grid2}>
                <label className={s.field}>
                  <span className={s.label}>Property</span>
                  <select value={propertyId} onChange={(evt) => setPropertyId(evt.target.value)} className={s.input}>
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
              {(showDiscipline || showInstructorFields) && (
                <div className={h.grid2}>
                  {showDiscipline && (
                    <SelectWithCustomFallback
                      label="Discipline"
                      value={discipline}
                      options={disciplineOptionNames}
                      onChange={setDiscipline}
                      placeholder="Choose…"
                      disabledReason="No disciplines set up for this property yet"
                    />
                  )}
                  {showInstructorFields && (
                    <SelectWithCustomFallback
                      label="Instructor"
                      value={instructors}
                      options={instructorOptionNames}
                      onChange={setInstructors}
                      placeholder="Choose…"
                      disabledReason="No instructors set up for this property yet"
                    />
                  )}
                </div>
              )}
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
                <span className={s.label}>Short summary</span>
                <input
                  type="text"
                  value={summary}
                  onChange={(evt) => setSummary(evt.target.value)}
                  className={s.input}
                  placeholder="One line shown on the event card"
                />
              </label>
              <label className={s.field}>
                <span className={s.label}>Description</span>
                <textarea
                  value={description}
                  onChange={(evt) => setDescription(evt.target.value)}
                  className={s.input}
                  rows={5}
                  placeholder="What guests will do, and anything they should know"
                />
              </label>
            </div>

            <div hidden={active !== "when"} className="flex flex-col gap-7">
              {isStanding ? (
                <>
                  <label className={s.field}>
                    <span className={s.label}>When it runs</span>
                    <input
                      type="text"
                      value={scheduleText}
                      onChange={(evt) => setScheduleText(evt.target.value)}
                      className={s.input}
                      placeholder="e.g. Tuesday and Thursday 7:30 AM, Saturday 8:00 AM"
                    />
                  </label>
                  <p className="text-[15px] text-gray">
                    An ongoing programme has no set date. Guests see this schedule instead of a date.
                  </p>
                </>
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
                  <RecurringDatesEditor
                    key={repeatPickerKey}
                    startDate={startAt.split("T")[0] ?? ""}
                    extraDates={extraDates}
                    onChange={setExtraDates}
                    isExistingEvent
                  />
                </>
              )}
            </div>

            <div hidden={active !== "spots"} className="flex flex-col gap-10">
              <div className={h.grid2}>
                <label className={s.field}>
                  <span className={s.label}>Total spots</span>
                  <input
                    type="number"
                    min={1}
                    value={maxCapacity}
                    onChange={(evt) => setMaxCapacity(evt.target.value)}
                    className={s.input}
                  />
                </label>
                <label className={s.field}>
                  <span className={s.label}>Most people one person can sign up</span>
                  <input
                    type="number"
                    min={1}
                    value={maxGuestsPerRegistration}
                    onChange={(evt) => setMaxGuestsPerRegistration(evt.target.value)}
                    className={s.input}
                  />
                </label>
              </div>
              <EventExtrasFields value={extrasState} onChange={setExtrasState} parts={["tickets"]} />
              <div className="flex flex-col gap-4">
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
                <span className="text-[17px] text-olive">Free for members (sets the member price to $0)</span>
              </label>
              </div>
              <div className="flex flex-col gap-2">
              <label className={s.field}>
                <span className={s.label}>Who it's for</span>
                <select
                  value={audience}
                  onChange={(evt) => setAudience(evt.target.value as EventAudience)}
                  className={s.input}
                >
                  <option value="members_and_public">Members and the public</option>
                  <option value="members_only">Members only</option>
                </select>
              </label>
              <p className="text-[15px] text-gray">“Who it's for” only labels the event. Anyone can still sign up.</p>
              </div>
            </div>

            <div hidden={active !== "guests"}>
              <EventExtrasFields value={extrasState} onChange={setExtrasState} parts={["gear", "questions"]}
                gearPicker={
                  <GearPicker
                    gear={extrasState.gear}
                    onChange={(gear) => setExtrasState((current) => ({ ...current, gear }))}
                    propertyId={propertyId}
                    propertyName={properties.find((property) => property.id === propertyId)?.name ?? "this property"}
                    presets={gearPresets}
                  />
                }
              />
            </div>

            <div hidden={active !== "page"} className="flex flex-col gap-10">
              <section>
                <h3 className={`${s.subhead} mb-3`}>Photo</h3>
                <EventImageInput value={imageUrl} onChange={setImageUrl} />
              </section>
              <section>
                <h3 className={s.subhead}>Extra sections</h3>
                <p className={h.groupDesc}>
                  More sections for the event page, like “What to expect”. Each one is a paragraph or a bullet list.
                </p>
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
              </section>
              <label className="flex items-center gap-2.5">
                <input type="checkbox" checked={featured} onChange={(evt) => setFeatured(evt.target.checked)} />
                <span className="text-[17px] text-olive">Feature this event (shows it large at the top of the calendar)</span>
              </label>
            </div>

            <div hidden={active !== "review"} className="flex flex-col gap-6">
              {allProblems.length > 0 && (
                <Alert variant="warn" title="A few things to fix first">
                  <ul className="mt-1 flex flex-col gap-1">
                    {allProblems.map((problem) => (
                      <li key={`${problem.section}-${problem.message}`}>
                        <button type="button" className="underline" onClick={() => goToStep(problem.section)}>
                          {SECTION_COPY[problem.section].label}
                        </button>
                        : {problem.message}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}

              <dl className="flex flex-col divide-y divide-rule border-y border-rule">
                {(Object.keys(summaries) as Array<keyof typeof summaries>).map((section) => {
                  const sectionState = statusOf(section);
                  return (
                    <div key={section} className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <dt className="text-[17px] font-semibold text-olive">{SECTION_COPY[section].label}</dt>
                        <dd className="mt-0.5 text-[17px] text-gray">{summaries[section] || "Not filled in yet"}</dd>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className={`text-[15px] ${STATUS_CLASS[sectionState]}`}>
                          {STATUS_MARK[sectionState]} {STATUS_LABEL[sectionState]}
                        </span>
                        <Button type="button" variant="link" size="sm" onClick={() => goToStep(section)}>
                          Change
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </dl>

              <label className={s.field}>
                <span className={s.label}>Status</span>
                <select
                  value={status}
                  onChange={(evt) => setStatus(evt.target.value as EventStatus)}
                  className={s.input}
                >
                  <option value="draft">Draft: only staff can see it</option>
                  <option value="published">Published: guests can see it and sign up</option>
                  <option value="sold_out">Sold out: guests can see it but can't sign up</option>
                  <option value="cancelled">Cancelled: guests can see it but can't sign up</option>
                  <option value="completed">Completed: guests can see it but can't sign up</option>
                </select>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={isManuallySoldOut}
                  onChange={(evt) => setIsManuallySoldOut(evt.target.checked)}
                />
                <span className="text-[17px] text-olive">
                  Mark as sold out (stops new sign-ups, even if spots are left)
                </span>
              </label>
              <label className="flex items-center gap-2.5">
                <input type="checkbox" checked={isTemplate} onChange={(evt) => setIsTemplate(evt.target.checked)} />
                <span className="text-[17px] text-olive">
                  Save as a template (guests won't see it; start new events from it with &quot;New from template&quot;)
                </span>
              </label>
            </div>

            <div className={`${h.actions} flex-wrap`}>
              {isLast && canPublish ? (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isPending}
                    onClick={() => save({ statusOverride: "published" })}
                  >
                    {isPending ? "Publishing…" : "Publish"}
                  </Button>
                  <Button type="submit" variant="secondary" disabled={isPending}>
                    Save as draft
                  </Button>
                </>
              ) : (
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending
                    ? "Saving…"
                    : extraDates.length > 0
                      ? `Save and add ${plural(extraDates.length, "date", "dates")}`
                      : isLast
                        ? "Save changes"
                        : "Save and continue"}
                </Button>
              )}
              {active !== "basics" && (
                <Button type="button" variant="ghost" disabled={isPending} onClick={goBack}>
                  Back
                </Button>
              )}
              {isLast && (
                <Button type="button" variant="ghost" disabled={isPending} onClick={handleDelete} className="ml-auto">
                  Delete event
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="2xl:sticky 2xl:top-6 max-w-[40rem]">
        <EventLivePreview event={previewData} />
      </div>
    </div>
  );
}
