"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { ADVENTURE_ATTRIBUTE_OPTIONS } from "@/src/components/public/adventure-attributes";
import { MarkdownField } from "@/src/components/admin/markdown-field";
import {
  AdventureImageInput,
  AdventureGalleryInput,
} from "@/src/components/admin/adventure-image-input";
import { deleteAdventureAction, saveAdventureAction } from "@/app/admin/adventures/actions";
import type { SaveAdventureInput } from "@/src/services/admin/save-adventure";
import type { AdminAdventureEditable } from "@/src/services/admin/adventures";

// Admin create/edit form for a member adventure. Columns + the details
// jsonb (category/location/labels, images, attributes, highlights,
// editorial sections). Submits SaveAdventureInput to saveAdventureAction;
// zod re-validates server-side.

interface Section {
  heading: string;
  body: string;
  image: string;
}

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2 font-serif text-[15px] text-olive focus:border-olive focus:outline-none bg-paper";
const sectionTitleCls = "font-serif font-semibold text-[22px] text-olive mt-7 mb-3";

export function AdventureEditorForm({
  properties,
  initial,
}: {
  properties: ReadonlyArray<{ id: string; name: string }>;
  initial?: AdminAdventureEditable;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const d = initial?.details;
  const [form, setForm] = useState({
    propertyId: initial?.propertyId ?? properties[0]?.id ?? "",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    startDate: initial?.startDate ?? "",
    endDate: initial?.endDate ?? "",
    maxCapacity: String(initial?.maxCapacity ?? 8),
    maxGuestsPerRsvp: String(initial?.maxGuestsPerRsvp ?? 2),
    price: String(initial?.price ?? 0),
    guestPrice: initial?.guestPrice != null ? String(initial.guestPrice) : "",
    depositAmount: initial?.depositAmount != null ? String(initial.depositAmount) : "",
    freeCancellationDays: String(initial?.freeCancellationDays ?? 14),
    paymentMode: initial?.paymentMode ?? "instant",
    status: initial?.status ?? "draft",
    isManuallySoldOut: initial?.isManuallySoldOut ?? false,
    category: d?.category ?? "",
    location: d?.location ?? "",
    durationLabel: d?.durationLabel ?? "",
    datesLabel: d?.datesLabel ?? "",
    priceLabel: d?.priceLabel ?? "",
    badge: d?.badge ?? "",
    comingSoon: d?.comingSoon ?? false,
    heroImage: d?.heroImage ?? "",
  });
  const [gallery, setGallery] = useState<string[]>(d?.gallery ?? []);
  const [attributes, setAttributes] = useState<string[]>(d?.attributes ?? []);
  const [highlights, setHighlights] = useState<string[]>(d?.highlights ?? []);
  const [sections, setSections] = useState<Section[]>(
    (d?.sections ?? []).map((s) => ({ heading: s.heading, body: s.body, image: s.image ?? "" })),
  );

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleAttr = (key: string) =>
    setAttributes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submit = () => {
    setError(null);
    const optNum = (s: string) => {
      const t = s.trim();
      if (!t) return null;
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : null;
    };
    const input: SaveAdventureInput = {
      id: initial?.id,
      propertyId: form.propertyId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      maxCapacity: parseInt(form.maxCapacity, 10) || 0,
      maxGuestsPerRsvp: parseInt(form.maxGuestsPerRsvp, 10) || 0,
      price: parseFloat(form.price) || 0,
      guestPrice: optNum(form.guestPrice),
      depositAmount: optNum(form.depositAmount),
      freeCancellationDays: parseInt(form.freeCancellationDays, 10) || 0,
      paymentMode: form.paymentMode as SaveAdventureInput["paymentMode"],
      status: form.status as SaveAdventureInput["status"],
      isManuallySoldOut: form.isManuallySoldOut,
      category: form.category.trim() || undefined,
      location: form.location.trim() || undefined,
      durationLabel: form.durationLabel.trim() || undefined,
      datesLabel: form.datesLabel.trim() || undefined,
      priceLabel: form.priceLabel.trim() || undefined,
      badge: form.badge.trim() || undefined,
      comingSoon: form.comingSoon,
      heroImage: form.heroImage.trim() || "",
      gallery: gallery.map((g) => g.trim()).filter(Boolean),
      attributes,
      highlights: highlights.map((h) => h.trim()).filter(Boolean),
      sections: sections
        .filter((s) => s.heading.trim() && s.body.trim())
        .map((s) => ({ heading: s.heading.trim(), body: s.body.trim(), image: s.image.trim() })),
    };

    startTransition(async () => {
      const result = await saveAdventureAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/admin/adventures/${result.id}`);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}

      <div className={sectionTitleCls}>Basics</div>
      <label>
        <span className={labelCls}>Property</span>
        <select className={inputCls} value={form.propertyId} onChange={(e) => set("propertyId", e.target.value)}>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <Field label="Title" value={form.title} onChange={(v) => set("title", v)} placeholder="Argentina Dove · Córdoba" />
      <MarkdownField
        label="Description"
        value={form.description}
        onChange={(v) => set("description", v)}
        height={220}
        hint="Use the toolbar for bold, italic, bullet lists, and links."
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date" type="date" value={form.startDate} onChange={(v) => set("startDate", v)} />
        <Field label="End date" type="date" value={form.endDate} onChange={(v) => set("endDate", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Max capacity" type="number" value={form.maxCapacity} onChange={(v) => set("maxCapacity", v)} />
        <Field label="Max guests / reservation" type="number" value={form.maxGuestsPerRsvp} onChange={(v) => set("maxGuestsPerRsvp", v)} />
      </div>

      <div className={sectionTitleCls}>Pricing &amp; payment</div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Price ($)" type="number" value={form.price} onChange={(v) => set("price", v)} />
        <Field label="Per-guest fee ($)" type="number" value={form.guestPrice} onChange={(v) => set("guestPrice", v)} placeholder="optional" />
        <Field label="Deposit ($)" type="number" value={form.depositAmount} onChange={(v) => set("depositAmount", v)} placeholder="deposit mode" />
      </div>
      <label>
        <span className={labelCls}>Payment mode</span>
        <select className={inputCls} value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value as typeof form.paymentMode)}>
          <option value="instant">Instant — full payment at RSVP</option>
          <option value="deposit">Deposit — pay deposit now, balance with concierge</option>
          <option value="inquire">Inquire — request, concierge follows up</option>
        </select>
      </label>
      <Field
        label="Free cancellation window (days before start)"
        type="number"
        value={form.freeCancellationDays}
        onChange={(v) => set("freeCancellationDays", v)}
      />
      <p className="font-serif italic text-[13px] text-gray m-0">
        Members who cancel at least this many days before the start get a full refund; inside the
        window the payment is forfeited.
      </p>

      <div className={sectionTitleCls}>Visibility</div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="inline-flex rounded-pill border border-rule overflow-hidden">
          <button
            type="button"
            onClick={() => set("status", "draft")}
            className={`px-5 py-2 font-sans text-[13px] tracking-[0.5px] uppercase ${form.status === "draft" ? "bg-olive text-cream" : "text-olive"}`}
          >
            Draft
          </button>
          <button
            type="button"
            onClick={() => set("status", "published")}
            className={`px-5 py-2 font-sans text-[13px] tracking-[0.5px] uppercase ${form.status !== "draft" ? "bg-olive text-cream" : "text-olive"}`}
          >
            Published
          </button>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isManuallySoldOut} onChange={(e) => set("isManuallySoldOut", e.target.checked)} />
          <span className="font-serif text-[14px] text-olive">Mark as sold out</span>
        </label>
      </div>
      <p className="font-serif italic text-[13px] text-gray m-0">
        Draft pages are visible only to staff via the &ldquo;View public page&rdquo; link. Published is
        live for members.
      </p>

      <div className={sectionTitleCls}>Card &amp; hero display</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category (eyebrow)" value={form.category} onChange={(v) => set("category", v)} placeholder="Wingshooting" />
        <Field label="Location (destination)" value={form.location} onChange={(v) => set("location", v)} placeholder="Córdoba, Argentina" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration label" value={form.durationLabel} onChange={(v) => set("durationLabel", v)} placeholder="5 nights / 4 hunting days" />
        <Field label="Badge override" value={form.badge} onChange={(v) => set("badge", v)} placeholder="Filling Fast" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dates label override" value={form.datesLabel} onChange={(v) => set("datesLabel", v)} placeholder="Dates to be announced" />
        <Field label="Price label override" value={form.priceLabel} onChange={(v) => set("priceLabel", v)} placeholder="Included" />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.comingSoon} onChange={(e) => set("comingSoon", e.target.checked)} />
        <span className="font-serif text-[14px] text-olive">Coming soon (not yet bookable)</span>
      </label>

      <div className={sectionTitleCls}>Images</div>
      <AdventureImageInput
        label="Hero image"
        value={form.heroImage}
        onChange={(v) => set("heroImage", v)}
        maxEdge={2400}
        hint="Recommended: landscape, at least 2000×1200 px (3:2). It's cropped tall on cards and wide on the detail page, so keep the subject centered. Upload any size — we resize & compress to web-ready WebP automatically."
      />
      <AdventureGalleryInput
        label="Gallery"
        items={gallery}
        setItems={setGallery}
        hint="Recommended: landscape, at least 1600×1200 px. The first image spans full width (best as a wide 21:9 shot); the rest tile in a 4:3 grid."
      />

      <div className={sectionTitleCls}>Type of stay (icons)</div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {ADVENTURE_ATTRIBUTE_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-center gap-1.5">
            <input type="checkbox" checked={attributes.includes(opt.key)} onChange={() => toggleAttr(opt.key)} />
            <span className="font-serif text-[14px] text-olive">{opt.label}</span>
          </label>
        ))}
      </div>

      <div className={sectionTitleCls}>What&rsquo;s included (highlights)</div>
      <StringList label="" items={highlights} setItems={setHighlights} placeholder="5 nights at a Córdoba estancia" addLabel="Add highlight" />

      <div className={sectionTitleCls}>Chapters</div>
      {sections.map((sec, i) => (
        <div key={i} className="border border-rule rounded p-3 flex flex-col gap-2">
          <div className="font-serif font-semibold text-[18px] text-olive">
            Chapter {i + 1}
          </div>
          <Field label="Heading" value={sec.heading} onChange={(v) =>
            setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, heading: v } : s)))
          } />
          <MarkdownField
            label="Body"
            value={sec.body}
            height={180}
            onChange={(v) =>
              setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, body: v } : s)))
            }
          />
          <AdventureImageInput
            label="Image (optional)"
            value={sec.image}
            onChange={(v) =>
              setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, image: v } : s)))
            }
            hint="Recommended: portrait, at least 1200×1500 px (4:5). Sits beside the chapter text."
          />
          <button type="button" className="self-start font-sans text-[12px] uppercase tracking-[0.5px] text-tan-deep" onClick={() =>
            setSections((prev) => prev.filter((_, idx) => idx !== i))
          }>
            Remove chapter
          </button>
        </div>
      ))}
      <button type="button" className="self-start font-sans text-[12px] uppercase tracking-[0.5px] text-tan-deep" onClick={() =>
        setSections((prev) => [...prev, { heading: "", body: "", image: "" }])
      }>
        + Add chapter
      </button>

      <div className="flex gap-3 mt-6 sticky bottom-3 items-center flex-wrap bg-paper border border-rule rounded-card px-4 py-3 shadow-[0_4px_24px_rgba(40,47,21,0.15)]">
        <Button type="button" variant="primary" loading={isPending} onClick={submit}>
          {isPending ? "Saving…" : initial ? "Save changes" : "Create adventure"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/adventures")} disabled={isPending}>
          Cancel
        </Button>
        {initial && (
          <button
            type="button"
            className="ml-auto font-sans text-[12px] uppercase tracking-[0.5px] text-[color:var(--error)] disabled:opacity-40"
            disabled={isPending}
            onClick={() => {
              if (!window.confirm("Delete this adventure? This can't be undone.")) return;
              setError(null);
              startTransition(async () => {
                const result = await deleteAdventureAction(initial.id);
                if (!result.ok) {
                  setError(result.error ?? "Couldn't delete.");
                  return;
                }
                router.push("/admin/adventures");
                router.refresh();
              });
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        className={inputCls}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function StringList({
  label,
  items,
  setItems,
  placeholder,
  addLabel,
}: {
  label: string;
  items: string[];
  setItems: (next: string[]) => void;
  placeholder?: string;
  addLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && <span className={labelCls}>{label}</span>}
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={inputCls}
            value={item}
            placeholder={placeholder}
            onChange={(e) => setItems(items.map((it, idx) => (idx === i ? e.target.value : it)))}
          />
          <button
            type="button"
            className="font-sans text-[12px] uppercase tracking-[0.5px] text-tan-deep whitespace-nowrap"
            onClick={() => setItems(items.filter((_, idx) => idx !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="self-start font-sans text-[12px] uppercase tracking-[0.5px] text-tan-deep"
        onClick={() => setItems([...items, ""])}
      >
        + {addLabel}
      </button>
    </div>
  );
}
