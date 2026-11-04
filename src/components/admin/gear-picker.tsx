"use client";

import { useState, useTransition, type ReactNode } from "react";
import { FlowButton as Button } from "./event-flow-button";
import { toEditableGear, toGearInput, type EditableGear } from "./event-extras-fields";
import {
  deleteGearPresetAction,
  saveGearPresetsAction,
  setGearPresetAddToNewEventsAction,
} from "@/app/admin/events/gear-preset-actions";
import { COMMON_GEAR } from "@/src/constants/admin/common-gear";
import { GearItemSchema, type GearItemInput } from "@/src/services/events/event-extras-contract";
import type { GearPreset } from "@/src/services/admin/gear-presets";
import f from "./event-flow.module.css";

// Quick add for the Gear section: tick gear from the property's saved list
// or the built-in common list and it's added to the event (untick to take
// it off). Admins can save the event's gear to the property's list and
// mark saved items to be added to every new event there.

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function describe(item: GearItemInput): string {
  const ways = [
    item.included && "included",
    item.bringOwnAllowed && "bring your own",
    item.rentPrice !== null && `rent $${item.rentPrice}`,
    item.buyPrice !== null && `buy $${item.buyPrice}`,
  ].filter(Boolean);
  return [item.isRequired ? "Required" : "Optional", ways.join(", ")].filter(Boolean).join(" · ");
}

function GearCheck({
  item,
  checked,
  onToggle,
  children,
}: {
  item: GearItemInput;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1 rounded-[10px] border border-[#d6ddd5] bg-white px-4 py-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-[#1f5b45]"
          checked={checked}
          onChange={(evt) => onToggle(evt.target.checked)}
        />
        <span className="flex flex-col">
          <span className="text-[18px] font-semibold text-[#1c2420]">{item.name}</span>
          <span className="text-[15px] text-[#5d6963]">{describe(item)}</span>
        </span>
      </label>
      {children}
    </li>
  );
}

export function GearPicker({
  gear,
  onChange,
  propertyId,
  propertyName,
  presets: initialPresets,
}: {
  gear: ReadonlyArray<EditableGear>;
  onChange: (next: EditableGear[]) => void;
  propertyId: string;
  propertyName: string;
  presets: ReadonlyArray<GearPreset>;
}) {
  const [open, setOpen] = useState(gear.length === 0);
  const [allPresets, setAllPresets] = useState<ReadonlyArray<GearPreset>>(initialPresets);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const saved = allPresets.filter((preset) => preset.propertyId === propertyId);
  const common = COMMON_GEAR.filter((item) => !saved.some((preset) => sameName(preset.name, item.name)));
  const hasItem = (name: string) => gear.some((row) => sameName(row.name, name));
  const addedCount = [...saved, ...common].filter((item) => hasItem(item.name)).length;

  const toggle = (item: GearItemInput, checked: boolean) => {
    if (checked) {
      if (!hasItem(item.name)) onChange([...gear, toEditableGear(item)]);
    } else {
      onChange(gear.filter((row) => !sameName(row.name, item.name)));
    }
  };

  // Swap this property's presets for the list a server action returned.
  const applyResult = (result: { ok: true; presets: GearPreset[] } | { ok: false; error: string }, okText: string) => {
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setAllPresets((current) => [...current.filter((preset) => preset.propertyId !== propertyId), ...result.presets]);
    setMessage({ kind: "ok", text: okText });
  };

  const namedGear = gear.filter((row) => row.name.trim());
  const saveEventGear = () => {
    setMessage(null);
    const items = namedGear.map(toGearInput).filter((item) => GearItemSchema.safeParse(item).success);
    if (items.length === 0) {
      setMessage({ kind: "error", text: "Give each item a name and at least one way to get it first." });
      return;
    }
    startTransition(async () => {
      const result = await saveGearPresetsAction({
        propertyId,
        items: items.map((item) => ({
          gear: item,
          addToNewEvents: saved.find((preset) => sameName(preset.name, item.name))?.addToNewEvents ?? false,
        })),
      });
      const skipped = namedGear.length - items.length;
      applyResult(
        result,
        `Saved ${items.length} item${items.length === 1 ? "" : "s"} to ${propertyName}'s list.${
          skipped ? ` ${skipped} skipped: each needs at least one way to get it.` : ""
        }`,
      );
    });
  };

  const setEveryEvent = (preset: GearPreset, value: boolean) => {
    setMessage(null);
    startTransition(async () => {
      applyResult(
        await setGearPresetAddToNewEventsAction(preset.id, value),
        value
          ? `${preset.name} will be added to every new ${propertyName} event.`
          : `${preset.name} won't be added to new events automatically.`,
      );
    });
  };

  const forget = (preset: GearPreset) => {
    setMessage(null);
    startTransition(async () => {
      applyResult(await deleteGearPresetAction(preset.id), `Took ${preset.name} off ${propertyName}'s list.`);
    });
  };

  return (
    <div className="mt-4 rounded-[14px] bg-[#f3f6f2] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[17px] text-[#3d4943]">
          Tick gear to add it, then change any price below.
          {addedCount > 0 && <strong className="ml-2 text-[#1f5b45]">{addedCount} added from the list</strong>}
        </p>
        <Button type="button" variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide gear list" : "Pick common gear"}
        </Button>
      </div>

      {open && (
        <div className="mt-5 flex flex-col gap-6">
          {saved.length > 0 && (
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-3 text-[17px] font-bold text-[#1c2420]">Saved for {propertyName}</legend>
              <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
                {saved.map((preset) => (
                  <GearCheck
                    key={preset.id}
                    item={preset}
                    checked={hasItem(preset.name)}
                    onToggle={(checked) => toggle(preset, checked)}
                  >
                    <div className="ml-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
                      <label className="flex items-center gap-2 text-[#3d4943]">
                        <input
                          type="checkbox"
                          className="accent-[#1f5b45]"
                          checked={preset.addToNewEvents}
                          disabled={isPending}
                          onChange={(evt) => setEveryEvent(preset, evt.target.checked)}
                        />
                        Add to every new event
                      </label>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => forget(preset)}
                        className="text-[#5d6963] underline underline-offset-2 hover:text-[#b3261e]"
                      >
                        Remove from list
                      </button>
                    </div>
                  </GearCheck>
                ))}
              </ul>
            </fieldset>
          )}

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-3 text-[17px] font-bold text-[#1c2420]">Common gear</legend>
            <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
              {common.map((item) => (
                <GearCheck
                  key={item.name}
                  item={item}
                  checked={hasItem(item.name)}
                  onToggle={(checked) => toggle(item, checked)}
                />
              ))}
            </ul>
          </fieldset>

          <div className="flex flex-col gap-2 border-t border-[#d6ddd5] pt-5">
            <p className="m-0 text-[16px] text-[#4a5650]">
              {`Use the same gear at most ${propertyName} events? Save it once and it shows up above next time. Tick`}{" "}
              &ldquo;Add to every new event&rdquo; and new drafts start with it.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              disabled={isPending || namedGear.length === 0}
              onClick={saveEventGear}
            >
              {isPending ? "Saving…" : `Save this event's gear to ${propertyName}'s list`}
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className={`m-0 mt-4 text-[16px] ${message.kind === "error" ? "text-[#b3261e]" : "text-[#1f5b45]"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
