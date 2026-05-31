"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/lib/ui";
import { updateBidContentAction } from "@/app/admin/bids/[id]/edit/actions";
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
    setOpen(true);
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
