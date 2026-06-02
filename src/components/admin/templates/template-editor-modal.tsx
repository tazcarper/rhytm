"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import type { BookingType } from "@/src/components/public/booking-flow/booking-flow-types";
import {
  BOOKING_TYPE_META,
  BOOKING_TYPE_ORDER,
} from "@/src/constants/public/booking-types";
import type {
  TemplateKind,
  TemplateScopes,
  ScopeVocabProperty,
  ScopeVocabService,
} from "@/src/services/admin/bid-content-templates";
import {
  createFaqTemplateAction,
  updateFaqTemplateAction,
  createGearTemplateAction,
  updateGearTemplateAction,
} from "@/app/admin/templates/actions";
import form from "@/src/components/admin/bid-editor-form.module.css";
import s from "./templates.module.css";

// The fields the modal needs, normalized across both kinds. `id` present means
// edit; absent means create. `primary` is question (FAQ) or name (gear);
// `secondary` is answer (FAQ) or description (gear).
export interface TemplateDraft {
  id?: string;
  primary: string;
  secondary: string;
  dedupeKey: string;
  displayOrder: number;
  isActive: boolean;
  scopes: TemplateScopes;
}

// One existing same-kind item the new/edited item can be set to override.
export interface TemplateSibling {
  id: string;
  primary: string;
  dedupeKey: string;
  scopeLabel: string;
}

interface TemplateEditorModalProps {
  kind: TemplateKind;
  draft: TemplateDraft;
  siblings: ReadonlyArray<TemplateSibling>;
  properties: ReadonlyArray<ScopeVocabProperty>;
  services: ReadonlyArray<ScopeVocabService>;
  onClose: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Standalone items get a guaranteed-unique key (slug + short uuid) so they can
// never accidentally collide with — and override — another item.
function generateDedupeKey(primary: string): string {
  return `${slugify(primary) || "item"}-${crypto.randomUUID().slice(0, 8)}`;
}

function dedupeByKey(
  items: ReadonlyArray<TemplateSibling>,
): TemplateSibling[] {
  const seen = new Set<string>();
  const out: TemplateSibling[] = [];
  for (const item of items) {
    if (seen.has(item.dedupeKey)) continue;
    seen.add(item.dedupeKey);
    out.push(item);
  }
  return out;
}

const KIND_COPY = {
  faq: {
    primaryLabel: "Question",
    primaryPlaceholder: "What's your cancellation policy?",
    secondaryLabel: "Answer",
    secondaryPlaceholder: "Full refund up to 7 days out…",
    primaryMax: 500,
    secondaryMax: 2000,
  },
  gear: {
    primaryLabel: "Item name",
    primaryPlaceholder: "Eye & ear protection",
    secondaryLabel: "Description",
    secondaryPlaceholder: "Provided on site, or bring your own.",
    primaryMax: 200,
    secondaryMax: 500,
  },
} as const;

function toggle<T>(list: ReadonlyArray<T>, value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function TemplateEditorModal({
  kind,
  draft,
  siblings,
  properties,
  services,
  onClose,
}: TemplateEditorModalProps) {
  const router = useRouter();
  const copy = KIND_COPY[kind];
  const isEdit = draft.id !== undefined;

  // Other same-kind items this one could override, one option per dedupe group.
  const others = siblings.filter((sibling) => sibling.id !== draft.id);
  const overrideOptions = dedupeByKey(others);
  const isCurrentlyShared = others.some(
    (sibling) => sibling.dedupeKey === draft.dedupeKey,
  );

  const [primary, setPrimary] = useState(draft.primary);
  const [secondary, setSecondary] = useState(draft.secondary);
  // "" = standalone; otherwise the dedupe key of the group it overrides.
  const [overrideKey, setOverrideKey] = useState(
    isCurrentlyShared ? draft.dedupeKey : "",
  );
  const [displayOrder, setDisplayOrder] = useState(String(draft.displayOrder));
  const [isActive, setIsActive] = useState(draft.isActive);
  const [scopes, setScopes] = useState<TemplateScopes>(draft.scopes);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isPending, onClose]);

  const setGlobal = (value: boolean) =>
    setScopes((prev) => ({ ...prev, global: value }));
  const toggleProperty = (id: string) =>
    setScopes((prev) => ({ ...prev, propertyIds: toggle(prev.propertyIds, id) }));
  const toggleService = (id: string) =>
    setScopes((prev) => ({ ...prev, serviceIds: toggle(prev.serviceIds, id) }));
  const toggleBookingType = (type: BookingType) =>
    setScopes((prev) => ({ ...prev, bookingTypes: toggle(prev.bookingTypes, type) }));

  // Resolve the stored key from the override choice: the chosen group's key
  // when overriding; the existing key when an edited item stays standalone;
  // otherwise a fresh unique key.
  const resolveDedupeKey = (): string => {
    if (overrideKey) return overrideKey;
    if (isEdit && draft.dedupeKey && !isCurrentlyShared) return draft.dedupeKey;
    return generateDedupeKey(primary);
  };

  const save = () => {
    setError(null);
    const order = Number.parseInt(displayOrder, 10);
    const displayOrderValue = Number.isFinite(order) ? order : 0;

    startTransition(async () => {
      const base = {
        dedupeKey: resolveDedupeKey(),
        displayOrder: displayOrderValue,
        scopes,
      };
      const result =
        kind === "faq"
          ? isEdit
            ? await updateFaqTemplateAction({
                id: draft.id as string,
                question: primary,
                answer: secondary,
                isActive,
                ...base,
              })
            : await createFaqTemplateAction({
                question: primary,
                answer: secondary,
                ...base,
              })
          : isEdit
            ? await updateGearTemplateAction({
                id: draft.id as string,
                name: primary,
                description: secondary,
                isActive,
                ...base,
              })
            : await createGearTemplateAction({
                name: primary,
                description: secondary,
                ...base,
              });

      if (!result.ok) {
        setError(result.error ?? "Couldn't save.");
        return;
      }
      onClose();
      router.refresh();
    });
  };

  const servicesByProperty = properties.map((property) => ({
    property,
    services: services.filter((service) => service.propertyId === property.id),
  }));

  // Guardrails. `hasNoScope` is a hard block (the item could never appear);
  // `globalConflict` is a soft warning — Global already covers every bid, so
  // pairing it with a narrower scope or an override is almost never intended.
  const hasNarrowerScope =
    scopes.propertyIds.length > 0 ||
    scopes.serviceIds.length > 0 ||
    scopes.bookingTypes.length > 0;
  const hasNoScope = !scopes.global && !hasNarrowerScope;
  const globalConflict =
    scopes.global && (hasNarrowerScope || overrideKey !== "");

  return (
    <div
      className={s.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit template" : "New template"}
    >
      <button
        type="button"
        className={s.backdrop}
        aria-label="Close"
        onClick={() => !isPending && onClose()}
      />
      <div className={s.panel}>
        <div className={s.panelHead}>
          <h2 className={s.panelTitle}>
            {isEdit ? "Edit" : "New"} {kind === "faq" ? "FAQ" : "gear"} item
          </h2>
          <button
            type="button"
            className={s.closeBtn}
            onClick={() => !isPending && onClose()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={s.panelBody}>
          {error && (
            <Alert variant="error" title="Couldn't save">
              {error}
            </Alert>
          )}

          <label className={form.field}>
            <span className={form.label}>{copy.primaryLabel}</span>
            <input
              type="text"
              className={form.input}
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              placeholder={copy.primaryPlaceholder}
              maxLength={copy.primaryMax}
            />
          </label>

          <label className={form.field}>
            <span className={form.label}>
              {copy.secondaryLabel}
              {kind === "gear" && " (optional)"}
            </span>
            <textarea
              className={form.textarea}
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              placeholder={copy.secondaryPlaceholder}
              maxLength={copy.secondaryMax}
              rows={3}
            />
          </label>

          <label className={form.field}>
            <span className={form.label}>Replaces an existing item? (optional)</span>
            <select
              className={s.filterSelect}
              value={overrideKey}
              onChange={(e) => setOverrideKey(e.target.value)}
            >
              <option value="">Nothing — this is its own item</option>
              {overrideOptions.map((option) => (
                <option key={option.dedupeKey} value={option.dedupeKey}>
                  {option.primary} ({option.scopeLabel})
                </option>
              ))}
            </select>
            <span className={form.help}>
              Pick an item to supersede it on bids this one also matches — e.g. a
              property-specific cancellation policy replacing the global one. The
              more specific scope always wins.
            </span>
          </label>

          <label className={form.field}>
            <span className={form.label}>Order</span>
            <input
              type="number"
              className={form.input}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              min={0}
              max={9999}
            />
            <span className={form.help}>
              Lower numbers appear first within the FAQ / gear list.
            </span>
          </label>

          {isEdit && (
            <label className={s.checkItem}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Active (inactive items are never auto-filled onto bids)</span>
            </label>
          )}

          <section className={s.scopeGroup}>
            <h3 className={s.scopeGroupTitle}>Scope — where this appears</h3>

            <label className={s.checkItem}>
              <input
                type="checkbox"
                checked={scopes.global}
                onChange={(e) => setGlobal(e.target.checked)}
              />
              <span>
                <strong>Global</strong> — every bid, every property
              </span>
            </label>

            <p className={s.propertyGroupLabel}>By property</p>
            <div className={s.checkList}>
              {properties.map((property) => (
                <label key={property.id} className={s.checkItem}>
                  <input
                    type="checkbox"
                    checked={scopes.propertyIds.includes(property.id)}
                    onChange={() => toggleProperty(property.id)}
                  />
                  <span>{property.name}</span>
                </label>
              ))}
            </div>

            <p className={s.propertyGroupLabel}>By booking type</p>
            <div className={s.checkList}>
              {BOOKING_TYPE_ORDER.map((type) => (
                <label key={type} className={s.checkItem}>
                  <input
                    type="checkbox"
                    checked={scopes.bookingTypes.includes(type)}
                    onChange={() => toggleBookingType(type)}
                  />
                  <span>{BOOKING_TYPE_META[type].title}</span>
                </label>
              ))}
            </div>

            <p className={s.propertyGroupLabel}>By discipline</p>
            <div className={s.checkList}>
              {servicesByProperty.map(({ property, services: propertyServices }) =>
                propertyServices.length === 0 ? null : (
                  <div key={property.id}>
                    <p className={s.propertyGroupLabel}>{property.name}</p>
                    {propertyServices.map((service) => (
                      <label key={service.id} className={s.checkItem}>
                        <input
                          type="checkbox"
                          checked={scopes.serviceIds.includes(service.id)}
                          onChange={() => toggleService(service.id)}
                        />
                        <span>{service.name}</span>
                      </label>
                    ))}
                  </div>
                ),
              )}
            </div>
          </section>

          {hasNoScope && (
            <Alert variant="warn" title="Pick a scope">
              This item has no scope, so it would never appear on any bid. Tick
              Global, or a property, discipline, or booking type.
            </Alert>
          )}

          {globalConflict && (
            <Alert variant="warn" title="Global applies everywhere">
              Global already covers every property, so the narrower selections
              {overrideKey !== "" ? " and the override" : ""} won&rsquo;t do what
              you expect — this item will still appear on every bid. To make it
              an override that only applies to the narrower scope, uncheck
              Global.
            </Alert>
          )}
        </div>

        <div className={s.panelFoot}>
          <Button
            variant="primary"
            size="md"
            onClick={save}
            loading={isPending}
            disabled={hasNoScope}
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
