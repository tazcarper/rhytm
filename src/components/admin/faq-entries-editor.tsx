"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import { saveFaqEntryAction, deleteFaqEntryAction } from "@/app/admin/properties/[id]/faq/actions";
import type { AdminFaqEntry } from "@/src/services/admin/faq";
import s from "./bid-editor-form.module.css";
import h from "./homepage-hero-form.module.css";

interface FaqEntriesEditorProps {
  propertyId: string;
  entries: ReadonlyArray<AdminFaqEntry>;
}

interface DraftEntry {
  id?: string;
  category: string;
  categoryOrder: number;
  question: string;
  answer: string;
  sortOrder: number;
}

const EMPTY_DRAFT: DraftEntry = { category: "", categoryOrder: 0, question: "", answer: "", sortOrder: 0 };

// Flat add/edit/remove/reorder CRUD over property_faq_entries — the client
// owns this table fully (no hardcoded fallback), so every row here is a
// real, persisted question. category_order/sort_order are plain numbers
// (matches the instructor roster's display_order idiom) rather than a
// drag-and-drop reorder UI, given the size of a typical FAQ (40+ rows).
export function FaqEntriesEditor({ propertyId, entries }: FaqEntriesEditorProps) {
  const categories = [...new Set(entries.map((e) => e.category))];

  return (
    <div className="flex flex-col gap-6">
      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-3">
          <h3 className={h.formTitle}>{category}</h3>
          {entries
            .filter((entry) => entry.category === category)
            .map((entry) => (
              <FaqEntryRow key={entry.id} propertyId={propertyId} entry={entry} />
            ))}
        </div>
      ))}

      <Card padding="loose" elevation="soft">
        <div className={h.formHead}>
          <h2 className={h.formTitle}>Add question</h2>
        </div>
        <FaqEntryForm propertyId={propertyId} draft={EMPTY_DRAFT} isNew />
      </Card>
    </div>
  );
}

function FaqEntryRow({ propertyId, entry }: { propertyId: string; entry: AdminFaqEntry }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteFaqEntryAction(propertyId, entry.id);
      router.refresh();
    });
  };

  return (
    <Card padding="default" elevation="soft">
      <FaqEntryForm
        propertyId={propertyId}
        draft={{
          id: entry.id,
          category: entry.category,
          categoryOrder: entry.categoryOrder,
          question: entry.question,
          answer: entry.answer,
          sortOrder: entry.sortOrder,
        }}
      />
      <div className="mt-3 flex items-center gap-2">
        {confirmingDelete ? (
          <>
            <span className="text-micro text-gray">Delete this question?</span>
            <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={handleDelete}>
              {isPending ? "Deleting…" : "Confirm delete"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}

function FaqEntryForm({
  propertyId,
  draft,
  isNew = false,
}: {
  propertyId: string;
  draft: DraftEntry;
  isNew?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(draft.category);
  const [categoryOrder, setCategoryOrder] = useState(draft.categoryOrder);
  const [question, setQuestion] = useState(draft.question);
  const [answer, setAnswer] = useState(draft.answer);
  const [sortOrder, setSortOrder] = useState(draft.sortOrder);

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveFaqEntryAction({
        id: draft.id,
        propertyId,
        category,
        categoryOrder,
        question,
        answer,
        sortOrder,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      if (isNew) {
        setCategory("");
        setQuestion("");
        setAnswer("");
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="error" title="Couldn't save">
          {error}
        </Alert>
      )}
      <div className={h.grid2}>
        <label className={s.field}>
          <span className={s.label}>Category</span>
          <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className={s.input} />
        </label>
        <label className={s.field}>
          <span className={s.label}>Category order</span>
          <input
            type="number"
            value={categoryOrder}
            onChange={(e) => setCategoryOrder(Number(e.target.value))}
            className={s.input}
          />
        </label>
      </div>
      <label className={s.field}>
        <span className={s.label}>Question</span>
        <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} className={s.input} />
      </label>
      <label className={s.field}>
        <span className={s.label}>Answer</span>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} className={s.textarea} rows={3} />
      </label>
      <label className={s.field}>
        <span className={s.label}>Order within category</span>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          className={s.input}
        />
      </label>
      <div className={h.actions}>
        <Button type="button" variant="primary" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? "Saving…" : isNew ? "Add question" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
