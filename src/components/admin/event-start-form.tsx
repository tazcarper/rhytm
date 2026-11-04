"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Compass,
  GraduationCap,
  PartyPopper,
  Repeat,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Alert } from "@/lib/ui";
import { FlowButton as Button } from "./event-flow-button";
import { ChoiceTiles, type ChoiceTile } from "./choice-tiles";
import { saveEventAction, saveEventExtrasAction } from "@/app/admin/events/actions";
import { EVENT_TYPES, EVENT_TYPE_EXAMPLES, type EventType } from "@/src/constants/admin/event-types";
import type { EventStarter, EventStarterKey } from "@/src/constants/admin/event-starters";
import { getPropertyBrandTint } from "@/src/constants/admin/property-brand-tints";
import { EMPTY_EVENT_EXTRAS, type GearItemInput } from "@/src/services/events/event-extras-contract";
import type { GearPreset } from "@/src/services/admin/gear-presets";
import s from "./event-flow.module.css";

export interface StartPropertyOption {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
}

const TYPE_ICONS: Record<EventType, LucideIcon> = {
  Training: GraduationCap,
  League: Users,
  Tournament: Trophy,
  Social: PartyPopper,
  Adventure: Compass,
  Standing: Repeat,
};

const STARTER_ICONS: Record<EventStarterKey, LucideIcon> = {
  single_day: CalendarDays,
  class_clinic: Target,
  league: Repeat,
};

const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

// The first step of a new event: the club, the kind of event and its name.
// Everything else (date, spots, prices, gear) gets a default, or the
// chosen starter's, and is filled in afterwards in the builder on the
// event's own page. The draft has no date yet; the builder's Date step
// asks for it and publishing waits until it's set.
export function EventStartForm({
  properties,
  defaultPropertyId,
  starters,
  initialStarterKey = null,
  newEventGear = [],
  footer,
}: {
  properties: ReadonlyArray<StartPropertyOption>;
  defaultPropertyId?: string;
  starters: ReadonlyArray<EventStarter>;
  initialStarterKey?: EventStarterKey | null;
  // Saved gear marked "Add to every new event", for any property; the
  // chosen property's items go on the new draft.
  newEventGear?: ReadonlyArray<GearPreset>;
  // Slot below the form: the copy-a-template line.
  footer?: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialStarter = starters.find((starter) => starter.key === initialStarterKey) ?? null;
  const knownDefault = properties.some((property) => property.id === defaultPropertyId) ? defaultPropertyId! : "";
  const [propertyId, setPropertyId] = useState<string>(knownDefault || (properties.length === 1 ? properties[0]!.id : ""));
  const [type, setType] = useState<EventType | "">(initialStarter?.defaults.type ?? "");
  const [title, setTitle] = useState("");
  const [starterKey, setStarterKey] = useState<EventStarterKey | "">(initialStarter?.key ?? "");
  const starter = starters.find((item) => item.key === starterKey) ?? null;

  const chooseStarter = (key: EventStarterKey | "") => {
    setStarterKey(key);
    // A starter suggests a kind, but never overrides one already chosen.
    const picked = starters.find((item) => item.key === key);
    if (picked && !type) setType(picked.defaults.type);
  };

  const propertyTiles: ReadonlyArray<ChoiceTile<string>> = properties.map((property) => ({
    value: property.id,
    label: property.name,
    example: property.tagline ?? undefined,
    accent: getPropertyBrandTint(property.slug),
    icon: <span className="text-[17px] font-bold tracking-wide">{monogram(property.name)}</span>,
  }));

  const typeTiles: ReadonlyArray<ChoiceTile<EventType>> = EVENT_TYPES.map((value) => {
    const Icon = TYPE_ICONS[value];
    return { value, label: value, example: EVENT_TYPE_EXAMPLES[value], icon: <Icon size={24} strokeWidth={2.2} /> };
  });

  const starterTiles: ReadonlyArray<ChoiceTile<EventStarterKey>> = starters.map((item) => {
    const Icon = STARTER_ICONS[item.key];
    return { value: item.key, label: item.label, example: item.example, icon: <Icon size={24} strokeWidth={2.2} /> };
  });

  const missing = [!propertyId && "the club", !type && "the kind of event", !title.trim() && "a name"].filter(
    Boolean,
  ) as string[];

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (missing.length > 0) {
      setError(`Choose ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")} to continue.`);
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await saveEventAction({
        propertyId,
        title: title.trim(),
        type: type || null,
        startAt: null,
        endAt: null,
        scheduleText: null,
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
      const starterExtras = starter?.extras ?? EMPTY_EVENT_EXTRAS;
      const propertyGear: GearItemInput[] = newEventGear
        .filter((preset) => preset.propertyId === propertyId)
        .filter((preset) => !starterExtras.gear.some((item) => item.name.toLowerCase() === preset.name.toLowerCase()))
        .map(({ id: _id, propertyId: _propertyId, addToNewEvents: _add, ...gear }) => gear);
      if (starter || propertyGear.length > 0) {
        const extras = await saveEventExtrasAction(result.id, {
          ...starterExtras,
          gear: [...starterExtras.gear, ...propertyGear],
        });
        if (!extras.ok) {
          setError(`The draft was saved, but not its tickets and gear: ${extras.error}`);
          return;
        }
      }
      router.push(`/admin/events/${result.id}?started=1&step=date`);
    });
  };

  return (
    <div className={`${s.panel} ${s.flow}`}>
      <div className={s.formHead}>
        <h2 className={s.formTitle}>Let's get the basics down</h2>
      </div>
      <p className={s.groupDesc}>
        Three quick choices. It's saved as a draft guests can't see, then you add the date, prices and the rest one
        step at a time.
      </p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10">
        {error && (
          <Alert variant="error" title="Couldn't start the event">
            {error}
          </Alert>
        )}

        <ChoiceTiles
          legend="1. Which club?"
          tiles={propertyTiles}
          value={propertyId}
          onChange={setPropertyId}
          examplePrefix=""
        />

        <ChoiceTiles
          legend="2. What kind of event?"
          tiles={typeTiles}
          value={type}
          onChange={(value) => setType(value)}
        />

        <label className={s.field}>
          <span className="text-[19px] font-bold text-[#1c2420]">3. What's it called?</span>
          <input
            type="text"
            value={title}
            onChange={(evt) => setTitle(evt.target.value)}
            className={s.input}
            placeholder="Thanksgiving Turkey Shoot"
            maxLength={200}
          />
        </label>

        <ChoiceTiles
          legend="Start from a typical setup (optional)"
          description="Fills in usual spots, tickets and gear for you. Tap again to clear it."
          tiles={starterTiles}
          value={starterKey}
          onChange={chooseStarter}
          allowClear
        />

        <div className={s.actions}>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Starting…" : "Continue"}
          </Button>
        </div>
      </form>
      {footer}
    </div>
  );
}
