"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, cn } from "@/lib/ui";
import { BOOKING_TYPE_META } from "@/src/constants/public/booking-types";
import type {
  BidContentLibrary,
  BidFaqTemplate,
  BidGearTemplate,
  TemplateKind,
  TemplateScopes,
} from "@/src/services/admin/bid-content-templates";
import {
  deleteFaqTemplateAction,
  deleteGearTemplateAction,
} from "@/app/admin/templates/actions";
import {
  TemplateEditorModal,
  type TemplateDraft,
} from "./template-editor-modal";
import s from "./templates.module.css";

interface TemplatesManagerProps {
  library: BidContentLibrary;
}

type EditorState =
  | { open: false }
  | { open: true; kind: TemplateKind; draft: TemplateDraft };

const EMPTY_SCOPES: TemplateScopes = {
  global: false,
  propertyIds: [],
  serviceIds: [],
  bookingTypes: [],
};

const PROPERTY_FILTER_ALL = "all";
const PROPERTY_FILTER_GLOBAL = "global";

export function TemplatesManager({ library }: TemplatesManagerProps) {
  const router = useRouter();
  const [kind, setKind] = useState<TemplateKind>("faq");
  const [propertyFilter, setPropertyFilter] = useState<string>(PROPERTY_FILTER_ALL);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  // serviceId -> propertyId, so a property filter can also match items scoped
  // to one of that property's disciplines.
  const servicePropertyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const service of library.services) map.set(service.id, service.propertyId);
    return map;
  }, [library.services]);
  const serviceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const service of library.services) map.set(service.id, service.name);
    return map;
  }, [library.services]);
  const propertyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of library.properties) map.set(property.id, property.name);
    return map;
  }, [library.properties]);

  const items: ReadonlyArray<BidFaqTemplate | BidGearTemplate> =
    kind === "faq" ? library.faq : library.gear;

  const matchesPropertyFilter = (scopes: TemplateScopes): boolean => {
    if (propertyFilter === PROPERTY_FILTER_ALL) return true;
    if (propertyFilter === PROPERTY_FILTER_GLOBAL) return scopes.global;
    return (
      scopes.propertyIds.includes(propertyFilter) ||
      scopes.serviceIds.some(
        (serviceId) => servicePropertyMap.get(serviceId) === propertyFilter,
      )
    );
  };

  const visible = items.filter((item) => matchesPropertyFilter(item.scopes));

  const titleOf = (item: BidFaqTemplate | BidGearTemplate) =>
    "question" in item ? item.question : item.name;
  const bodyOf = (item: BidFaqTemplate | BidGearTemplate) =>
    "answer" in item ? item.answer : item.description;

  const scopeTags = (scopes: TemplateScopes): ReadonlyArray<{ label: string; global?: boolean }> => {
    const tags: Array<{ label: string; global?: boolean }> = [];
    if (scopes.global) tags.push({ label: "Global", global: true });
    for (const id of scopes.propertyIds)
      tags.push({ label: propertyNameMap.get(id) ?? "Property" });
    for (const type of scopes.bookingTypes)
      tags.push({ label: BOOKING_TYPE_META[type].title });
    for (const id of scopes.serviceIds)
      tags.push({ label: serviceNameMap.get(id) ?? "Discipline" });
    return tags;
  };

  const openCreate = () =>
    setEditor({
      open: true,
      kind,
      draft: {
        primary: "",
        secondary: "",
        dedupeKey: "",
        displayOrder: 0,
        isActive: true,
        scopes: EMPTY_SCOPES,
      },
    });

  const openEdit = (item: BidFaqTemplate | BidGearTemplate) =>
    setEditor({
      open: true,
      kind,
      draft: {
        id: item.id,
        primary: titleOf(item),
        secondary: bodyOf(item) ?? "",
        dedupeKey: item.dedupeKey,
        displayOrder: item.displayOrder,
        isActive: item.isActive,
        scopes: item.scopes,
      },
    });

  const remove = (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    startDelete(async () => {
      const action =
        kind === "faq" ? deleteFaqTemplateAction : deleteGearTemplateAction;
      await action(id);
      setConfirmingId(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className={s.toolbar}>
        <div className={s.tabs} role="tablist" aria-label="Template kind">
          <button
            type="button"
            role="tab"
            aria-selected={kind === "faq"}
            className={cn(s.tab, kind === "faq" && s.tabActive)}
            onClick={() => setKind("faq")}
          >
            FAQ ({library.faq.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "gear"}
            className={cn(s.tab, kind === "gear" && s.tabActive)}
            onClick={() => setKind("gear")}
          >
            Gear ({library.gear.length})
          </button>
        </div>

        <select
          className={s.filterSelect}
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          aria-label="Filter by property"
        >
          <option value={PROPERTY_FILTER_ALL}>All scopes</option>
          <option value={PROPERTY_FILTER_GLOBAL}>Global only</option>
          {library.properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>

        <div className={s.spacer} />
        <Button variant="primary" size="sm" onClick={openCreate}>
          + New {kind === "faq" ? "FAQ" : "gear"} item
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className={s.empty}>
          No {kind === "faq" ? "FAQ" : "gear"} items
          {propertyFilter === PROPERTY_FILTER_ALL ? " yet" : " for this filter"}.
        </p>
      ) : (
        <div className={s.list}>
          {visible.map((item) => {
            const body = bodyOf(item);
            return (
              <div
                key={item.id}
                className={cn(s.card, !item.isActive && s.cardInactive)}
              >
                <div className={s.cardMain}>
                  <p className={s.cardTitle}>{titleOf(item)}</p>
                  {body && <p className={s.cardBody}>{body}</p>}
                  <div className={s.cardMeta}>
                    <span className={s.dedupe}>{item.dedupeKey}</span>
                    {!item.isActive && (
                      <span className={s.inactiveBadge}>Inactive</span>
                    )}
                    <span className={s.scopeTags}>
                      {scopeTags(item.scopes).map((tag, index) => (
                        <span
                          key={`${tag.label}-${index}`}
                          className={cn(s.tag, tag.global && s.tagGlobal)}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
                <div className={s.cardActions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEdit(item)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant={confirmingId === item.id ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => remove(item.id)}
                    loading={isDeleting && confirmingId === item.id}
                  >
                    {confirmingId === item.id ? "Confirm" : "Delete"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editor.open && (
        <TemplateEditorModal
          kind={editor.kind}
          draft={editor.draft}
          siblings={items.map((item) => ({
            id: item.id,
            primary: titleOf(item),
            dedupeKey: item.dedupeKey,
            scopeLabel:
              scopeTags(item.scopes)
                .map((tag) => tag.label)
                .join(", ") || "No scope",
          }))}
          properties={library.properties}
          services={library.services}
          onClose={() => setEditor({ open: false })}
        />
      )}
    </>
  );
}
