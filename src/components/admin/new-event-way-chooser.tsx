"use client";

import { useState, type ReactNode } from "react";

type Way = "describe" | "manual";

const WAYS: ReadonlyArray<{ key: Way; label: string; hint: string }> = [
  { key: "describe", label: "Describe it", hint: "Tell the helper in a sentence or two" },
  { key: "manual", label: "Fill it in myself", hint: "Four quick fields to start" },
];

// The new-event screen shows one way of starting at a time, so the page
// isn't three forms stacked up. The two panels are passed in as slots;
// the chooser only decides which one is visible.
export function NewEventWayChooser({
  describe,
  manual,
  initialWay,
}: {
  describe: ReactNode;
  manual: ReactNode;
  initialWay: Way;
}) {
  const [way, setWay] = useState<Way>(initialWay);

  return (
    <div className="mt-6">
      <div role="tablist" aria-label="How to start" className="mb-4 grid gap-2 sm:grid-cols-2">
        {WAYS.map((option) => {
          const isActive = option.key === way;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setWay(option.key)}
              className={`rounded-sharp border px-4 py-3 text-left transition-colors ${
                isActive ? "border-olive bg-paper" : "border-rule hover:border-olive"
              }`}
            >
              <span className="block text-[15px] font-semibold text-olive">{option.label}</span>
              <span className="mt-0.5 block text-[13px] text-gray">{option.hint}</span>
            </button>
          );
        })}
      </div>
      <div role="tabpanel" hidden={way !== "describe"}>
        {describe}
      </div>
      <div role="tabpanel" hidden={way !== "manual"}>
        {manual}
      </div>
    </div>
  );
}
