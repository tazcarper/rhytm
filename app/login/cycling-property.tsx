"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./login.module.css";

const PROPERTIES = ["Horseshoe Bay", "Hog Heaven", "Packsaddle"];

// Timings mirror Tobias Ahlin's ml12 (https://tobiasahlin.com/moving-letters/)
// but trimmed for a cycling rotator. ENTER_MS / EXIT_MS are the per-letter
// animation durations; CASCADE_MS is the stagger between adjacent letters
// in both phases; BETWEEN_MS is the pause after the last letter finishes
// entering before the first letter starts exiting.
const ENTER_MS = 900;
const EXIT_MS = 800;
const CASCADE_MS = 30;
const BETWEEN_MS = 100;

function letterCount(text: string): number {
  return text.replace(/\s/g, "").length;
}

function exitStartMs(text: string): number {
  return ENTER_MS + CASCADE_MS * Math.max(0, letterCount(text) - 1) + BETWEEN_MS;
}

function totalCycleMs(text: string): number {
  const lastIdx = Math.max(0, letterCount(text) - 1);
  return exitStartMs(text) + CASCADE_MS * lastIdx + EXIT_MS;
}

// One interval length for all names — pick the longest so every name's full
// exit completes before the next mounts. Small buffer avoids the dead frame
// where forwards-held letters would otherwise unmount mid-paint.
const CYCLE_MS = Math.max(...PROPERTIES.map(totalCycleMs)) + 60;

export function CyclingProperty() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % PROPERTIES.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const text = PROPERTIES[index];
  const exitStart = exitStartMs(text);
  let visibleIdx = 0;

  return (
    <div className={styles.propertyCycler} aria-live="polite">
      <span key={index} className={styles.propertyName}>
        <span className={styles.letters}>
          {[...text].map((char, i) => {
            if (/\s/.test(char)) {
              return (
                <span key={i} className={styles.space}>
                  &nbsp;
                </span>
              );
            }
            const enterDelay = CASCADE_MS * visibleIdx;
            const exitDelay = exitStart + CASCADE_MS * visibleIdx;
            visibleIdx++;
            return (
              <span
                key={i}
                className={styles.letter}
                style={
                  {
                    "--enter-delay": `${enterDelay}ms`,
                    "--exit-delay": `${exitDelay}ms`,
                  } as CSSProperties
                }
              >
                {char}
              </span>
            );
          })}
        </span>
      </span>
    </div>
  );
}
