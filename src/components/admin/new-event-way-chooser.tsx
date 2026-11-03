"use client";

import { useState, type ReactNode } from "react";
import f from "./event-flow.module.css";

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
    <div className={`mt-6 ${f.flow}`}>
      <div role="tablist" aria-label="How to start" className={`mb-6 ${f.tabs}`}>
        {WAYS.map((option) => {
          const isActive = option.key === way;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setWay(option.key)}
              className={`${f.tab} ${isActive ? f.tabActive : ""}`}
            >
              <span className={f.tabLabel}>{option.label}</span>
              <span className={f.tabHint}>{option.hint}</span>
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
