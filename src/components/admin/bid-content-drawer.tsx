"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import {
  updateBidContentAction,
  repullBidContentAction,
} from "@/app/admin/bids/[id]/edit/actions";
import type { BidLibraryContent } from "@/src/services/admin/resolve-bid-library";
import form from "./bid-editor-form.module.css";
import s from "./bid-content-drawer.module.css";

interface GearDraft {
  name: string;
  description: string;
}

interface FaqDraft {
  question: string;
  answer: string;
}

interface BidContentDrawerProps {
  bidId: string;
  scheduleNotes: string | null;
  staffNotes: string | null;
  gearList: ReadonlyArray<{ name: string; description?: string | null }>;
  faq: ReadonlyArray<{ question: string; answer: string }>;
}

export function BidContentDrawer({
  bidId,
  scheduleNotes,
  staffNotes,
  gearList,
  faq,
}: BidContentDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [scheduleDraft, setScheduleDraft] = useState(scheduleNotes ?? "");
  const [staffDraft, setStaffDraft] = useState(staffNotes ?? "");
  const [gearDraft, setGearDraft] = useState<GearDraft[]>([]);
  const [faqDraft, setFaqDraft] = useState<FaqDraft[]>([]);

  // Content-library state. Fetched once per drawer instance (cached in
  // `library`) and reused for both Re-pull and the per-section pickers.
  const [library, setLibrary] = useState<BidLibraryContent | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [showGearLibrary, setShowGearLibrary] = useState(false);
  const [showFaqLibrary, setShowFaqLibrary] = useState(false);
  const [confirmRepull, setConfirmRepull] = useState(false);

  // Seed the drafts from the source-of-truth props each time the drawer
  // opens so a cancel-then-reopen always reflects what's actually saved.
  const openDrawer = () => {
    setScheduleDraft(scheduleNotes ?? "");
    setStaffDraft(staffNotes ?? "");
    setGearDraft(
      gearList.map((gear) => ({
        name: gear.name,
        description: gear.description ?? "",
      })),
    );
    setFaqDraft(faq.map((item) => ({ question: item.question, answer: item.answer })));
    setError(null);
    setLibraryError(null);
    setShowGearLibrary(false);
    setShowFaqLibrary(false);
    setConfirmRepull(false);
    setOpen(true);
  };

  // Lazy-load (and cache) what the content library would auto-fill for this
  // bid. Resolve-only — nothing is persisted until Save.
  const ensureLibrary = async (): Promise<BidLibraryContent | null> => {
    if (library) return library;
    setLibraryLoading(true);
    setLibraryError(null);
    const result = await repullBidContentAction(bidId);
    setLibraryLoading(false);
    if (!result.ok) {
      setLibraryError(result.error || "Couldn't load the content library.");
      return null;
    }
    setLibrary(result.content);
    return result.content;
  };

  const gearPresent = (name: string) =>
    gearDraft.some((g) => g.name.trim().toLowerCase() === name.trim().toLowerCase());
  const faqPresent = (question: string) =>
    faqDraft.some(
      (item) => item.question.trim().toLowerCase() === question.trim().toLowerCase(),
    );

  const openGearLibrary = async () => {
    const content = await ensureLibrary();
    if (content) setShowGearLibrary(true);
  };
  const openFaqLibrary = async () => {
    const content = await ensureLibrary();
    if (content) setShowFaqLibrary(true);
  };

  const addLibraryGear = (item: { name: string; description?: string }) =>
    setGearDraft((prev) => [
      ...prev,
      { name: item.name, description: item.description ?? "" },
    ]);
  const addLibraryFaq = (item: FaqDraft) =>
    setFaqDraft((prev) => [...prev, { question: item.question, answer: item.answer }]);

  // Two-click: first click loads + arms the confirm, second replaces both
  // lists with the resolved library content (discarding manual edits).
  const repull = async () => {
    const content = await ensureLibrary();
    if (!content) {
      setConfirmRepull(false);
      return;
    }
    if (!confirmRepull) {
      setConfirmRepull(true);
      return;
    }
    setGearDraft(
      content.gearList.map((item) => ({
        name: item.name,
        description: item.description ?? "",
      })),
    );
    setFaqDraft(
      content.faq.map((item) => ({ question: item.question, answer: item.answer })),
    );
    setConfirmRepull(false);
  };

  // Escape to close + body scroll lock while the overlay is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isPending]);

  const updateGear = (index: number, patch: Partial<GearDraft>) =>
    setGearDraft((prev) =>
      prev.map((gear, idx) => (idx === index ? { ...gear, ...patch } : gear)),
    );
  const removeGear = (index: number) =>
    setGearDraft((prev) => prev.filter((_, idx) => idx !== index));
  const addGear = () =>
    setGearDraft((prev) => [...prev, { name: "", description: "" }]);

  const updateFaq = (index: number, patch: Partial<FaqDraft>) =>
    setFaqDraft((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  const removeFaq = (index: number) =>
    setFaqDraft((prev) => prev.filter((_, idx) => idx !== index));
  const addFaq = () =>
    setFaqDraft((prev) => [...prev, { question: "", answer: "" }]);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateBidContentAction({
        bidId,
        scheduleNotes: scheduleDraft.trim() || null,
        staffNotes: staffDraft.trim() || null,
        gearList: gearDraft
          .filter((gear) => gear.name.trim())
          .map((gear) => ({
            name: gear.name.trim(),
            description: gear.description.trim() || undefined,
          })),
        faq: faqDraft
          .filter((item) => item.question.trim() && item.answer.trim())
          .map((item) => ({
            question: item.question.trim(),
            answer: item.answer.trim(),
          })),
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  // Library items not already in the draft (matched by name / question).
  const gearSuggestions = (library?.gearList ?? []).filter(
    (item) => !gearPresent(item.name),
  );
  const faqSuggestions = (library?.faq ?? []).filter(
    (item) => !faqPresent(item.question),
  );

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openDrawer} fullWidth>
        Edit bid content
      </Button>

      {open && (
        <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Edit bid content">
          <button
            type="button"
            className={s.backdrop}
            aria-label="Close"
            onClick={() => !isPending && setOpen(false)}
          />
          <div className={s.panel}>
            <div className={s.panelHead}>
              <h2 className={s.panelTitle}>Edit bid content</h2>
              <button
                type="button"
                className={s.closeBtn}
                onClick={() => !isPending && setOpen(false)}
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

              <section className={form.section}>
                <h3 className={form.sectionTitle}>Content library</h3>
                {libraryError && (
                  <Alert variant="error" title="Library">
                    {libraryError}
                  </Alert>
                )}
                <p className={form.help}>
                  Re-pull replaces the gear and FAQ below with what the library
                  auto-fills for this bid. Or use &ldquo;Add from library&rdquo;
                  in each section to pull individual items without losing your
                  edits.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-2)",
                    alignItems: "center",
                  }}
                >
                  <Button
                    variant={confirmRepull ? "primary" : "secondary"}
                    size="sm"
                    onClick={repull}
                    loading={libraryLoading}
                  >
                    {confirmRepull
                      ? "Confirm — replace gear + FAQ"
                      : "Re-pull from library"}
                  </Button>
                  {confirmRepull && (
                    <button
                      type="button"
                      className={form.removeBtn}
                      onClick={() => setConfirmRepull(false)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </section>

              <section className={form.section}>
                <h3 className={form.sectionTitle}>Schedule notes</h3>
                <label className={form.field}>
                  <textarea
                    value={scheduleDraft}
                    onChange={(e) => setScheduleDraft(e.target.value)}
                    className={form.textarea}
                    placeholder="Arrival, briefing, lunch, range time, departure…"
                    maxLength={5000}
                  />
                  <span className={form.help}>
                    Shown to the guest on the bid page. Markdown supported.
                  </span>
                </label>
              </section>

              <section className={form.section}>
                <h3 className={form.sectionTitle}>Gear list ({gearDraft.length})</h3>
                <div className={form.repeaterList}>
                  {gearDraft.length === 0 && (
                    <p className={form.emptyRepeater}>No gear items yet.</p>
                  )}
                  {gearDraft.map((gear, index) => (
                    <div key={index} className={form.repeaterItem}>
                      <div className={form.repeaterFields}>
                        <input
                          type="text"
                          value={gear.name}
                          onChange={(e) => updateGear(index, { name: e.target.value })}
                          className={form.input}
                          placeholder="Item name (e.g. Eye + ear protection)"
                          maxLength={200}
                        />
                        <textarea
                          value={gear.description}
                          onChange={(e) =>
                            updateGear(index, { description: e.target.value })
                          }
                          className={form.textarea}
                          placeholder="Description (optional, markdown supported)"
                          maxLength={500}
                          rows={2}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGear(index)}
                        className={form.removeBtn}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                {gearDraft.length < 20 && (
                  <button type="button" onClick={addGear} className={form.addBtn}>
                    + Add gear item
                  </button>
                )}
                {!showGearLibrary ? (
                  <button
                    type="button"
                    onClick={openGearLibrary}
                    className={form.addBtn}
                    disabled={libraryLoading}
                  >
                    {libraryLoading ? "Loading…" : "Add from library"}
                  </button>
                ) : (
                  <div className={form.repeaterList}>
                    {gearSuggestions.length === 0 ? (
                      <p className={form.emptyRepeater}>
                        Nothing new in the library for this bid.
                      </p>
                    ) : (
                      gearSuggestions.map((item, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => addLibraryGear(item)}
                          className={form.addBtn}
                        >
                          + {item.name}
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      className={form.removeBtn}
                      onClick={() => setShowGearLibrary(false)}
                    >
                      Done
                    </button>
                  </div>
                )}
              </section>

              <section className={form.section}>
                <h3 className={form.sectionTitle}>FAQ ({faqDraft.length})</h3>
                <div className={form.repeaterList}>
                  {faqDraft.length === 0 && (
                    <p className={form.emptyRepeater}>No FAQ items yet.</p>
                  )}
                  {faqDraft.map((item, index) => (
                    <div key={index} className={form.repeaterItem}>
                      <div className={form.repeaterFields}>
                        <input
                          type="text"
                          value={item.question}
                          onChange={(e) =>
                            updateFaq(index, { question: e.target.value })
                          }
                          className={form.input}
                          placeholder="Question"
                          maxLength={500}
                        />
                        <textarea
                          value={item.answer}
                          onChange={(e) => updateFaq(index, { answer: e.target.value })}
                          className={form.textarea}
                          placeholder="Answer (markdown supported)"
                          maxLength={2000}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFaq(index)}
                        className={form.removeBtn}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                {faqDraft.length < 20 && (
                  <button type="button" onClick={addFaq} className={form.addBtn}>
                    + Add FAQ item
                  </button>
                )}
                {!showFaqLibrary ? (
                  <button
                    type="button"
                    onClick={openFaqLibrary}
                    className={form.addBtn}
                    disabled={libraryLoading}
                  >
                    {libraryLoading ? "Loading…" : "Add from library"}
                  </button>
                ) : (
                  <div className={form.repeaterList}>
                    {faqSuggestions.length === 0 ? (
                      <p className={form.emptyRepeater}>
                        Nothing new in the library for this bid.
                      </p>
                    ) : (
                      faqSuggestions.map((item, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => addLibraryFaq(item)}
                          className={form.addBtn}
                        >
                          + {item.question}
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      className={form.removeBtn}
                      onClick={() => setShowFaqLibrary(false)}
                    >
                      Done
                    </button>
                  </div>
                )}
              </section>

              <section className={form.section}>
                <h3 className={form.sectionTitle}>Staff notes</h3>
                <label className={form.field}>
                  <textarea
                    value={staffDraft}
                    onChange={(e) => setStaffDraft(e.target.value)}
                    className={form.textarea}
                    placeholder="Internal notes — never shown to the guest."
                    maxLength={5000}
                  />
                  <span className={form.help}>
                    🔒 Internal only. Markdown supported.
                  </span>
                </label>
              </section>
            </div>

            <div className={s.panelFoot}>
              <Button variant="primary" size="md" onClick={save} loading={isPending}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
