"use client";

import { Button } from "@/lib/ui";
import type { EventInfoBoxType } from "@/src/services/admin/events";
import s from "./bid-editor-form.module.css";
import h from "./homepage-hero-form.module.css";

export interface EditableInfoBox {
  key: string; // client-side stable key, not persisted
  id?: string;
  boxType: EventInfoBoxType;
  heading: string;
  body: string;
  items: string[];
}

interface EventInfoBoxEditorProps {
  boxes: EditableInfoBox[];
  onChange: (boxes: EditableInfoBox[]) => void;
}

// Admin-authorable content blocks for an event's detail page — arbitrary
// description/list boxes ("what to expect", "required gear") the admin can
// add, reorder, and remove, rather than fixed schema columns.
export function EventInfoBoxEditor({ boxes, onChange }: EventInfoBoxEditorProps) {
  function addBox() {
    onChange([
      ...boxes,
      { key: crypto.randomUUID(), boxType: "description", heading: "", body: "", items: [""] },
    ]);
  }

  function removeBox(key: string) {
    onChange(boxes.filter((box) => box.key !== key));
  }

  function moveBox(key: string, direction: -1 | 1) {
    const index = boxes.findIndex((box) => box.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= boxes.length) return;
    const next = [...boxes];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function updateBox(key: string, patch: Partial<EditableInfoBox>) {
    onChange(boxes.map((box) => (box.key === key ? { ...box, ...patch } : box)));
  }

  function updateItem(key: string, itemIndex: number, value: string) {
    const box = boxes.find((b) => b.key === key);
    if (!box) return;
    const items = [...box.items];
    items[itemIndex] = value;
    updateBox(key, { items });
  }

  function addItem(key: string) {
    const box = boxes.find((b) => b.key === key);
    if (!box) return;
    updateBox(key, { items: [...box.items, ""] });
  }

  function removeItem(key: string, itemIndex: number) {
    const box = boxes.find((b) => b.key === key);
    if (!box) return;
    updateBox(key, { items: box.items.filter((_, i) => i !== itemIndex) });
  }

  return (
    <div className="flex flex-col gap-4">
      {boxes.map((box, index) => (
        <div key={box.key} className="rounded-card border border-rule p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-micro uppercase tracking-label text-gray">
              Box {index + 1}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={() => moveBox(box.key, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={index === boxes.length - 1}
                onClick={() => moveBox(box.key, 1)}
              >
                ↓
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeBox(box.key)}>
                Remove
              </Button>
            </div>
          </div>

          <div className={h.grid2}>
            <label className={s.field}>
              <span className={s.label}>Type</span>
              <select
                value={box.boxType}
                onChange={(event) =>
                  updateBox(box.key, { boxType: event.target.value as EventInfoBoxType })
                }
                className={s.input}
              >
                <option value="description">Description</option>
                <option value="list">List</option>
              </select>
            </label>
            <label className={s.field}>
              <span className={s.label}>Heading</span>
              <input
                type="text"
                value={box.heading}
                onChange={(event) => updateBox(box.key, { heading: event.target.value })}
                className={s.input}
                placeholder="What to expect"
              />
            </label>
          </div>

          {box.boxType === "description" ? (
            <label className={s.field}>
              <span className={s.label}>Body</span>
              <textarea
                value={box.body}
                onChange={(event) => updateBox(box.key, { body: event.target.value })}
                className={s.input}
                rows={4}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-2">
              <span className={s.label}>Items</span>
              {box.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(event) => updateItem(box.key, itemIndex, event.target.value)}
                    className={s.input}
                    placeholder="Eye and ear protection"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(box.key, itemIndex)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => addItem(box.key)}>
                Add item
              </Button>
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={addBox}>
        Add info box
      </Button>
    </div>
  );
}
