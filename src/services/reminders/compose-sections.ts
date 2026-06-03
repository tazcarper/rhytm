import type { BlockKey } from "./cadence-plan";

// Turns a set of content blocks + the trip's data into the rendered sections
// of a pre-visit email. A block whose data is absent (e.g. a property with no
// directions filled in) is silently skipped — so the email only ever shows
// sections that have real content. The `weather` and `arrival` blocks are
// always derivable (generic advice / the known start time), so they never
// drop out.
//
// Kept separate from both the planner (which decides WHICH blocks, WHEN) and
// the template (which only renders) so the composition rule is one testable
// place. Sections carry plain strings, not ReactNodes, so the props stay
// serializable for the dev-outbox payload log.

export interface ReminderContent {
  // Pre-formatted "9 AM CT" — for the arrival line.
  timeLabel: string;
  gearList: string[];
  scheduleNotes: string | null; // per-trip "what to expect"
  directions: string | null; // property-level
  parking: string | null; // property-level
  arrivalContact: string | null; // property-level "who to ask for"
  supportPhone: string | null;
}

export interface ReminderSection {
  heading: string;
  body?: string;
  items?: string[];
}

export function composeReminderSections(
  blocks: BlockKey[],
  content: ReminderContent,
): ReminderSection[] {
  const sections: ReminderSection[] = [];

  for (const block of blocks) {
    switch (block) {
      case "gear":
        if (content.gearList.length > 0) {
          sections.push({ heading: "What to bring", items: content.gearList });
        }
        break;
      case "expectations":
        if (content.scheduleNotes) {
          sections.push({
            heading: "What to expect",
            body: content.scheduleNotes,
          });
        }
        break;
      case "directions":
        if (content.directions) {
          sections.push({ heading: "Getting here", body: content.directions });
        }
        break;
      case "parking":
        if (content.parking) {
          sections.push({ heading: "Parking", body: content.parking });
        }
        break;
      case "weather":
        sections.push({
          heading: "Weather",
          body: "Keep an eye on the forecast as your date nears and dress in layers — we run rain or shine unless you hear otherwise from us.",
        });
        break;
      case "arrival":
        sections.push({
          heading: "Arrival",
          body: `Plan to arrive a few minutes before ${content.timeLabel} so we can get you settled and started on time.`,
        });
        break;
      case "contact": {
        const body =
          content.arrivalContact ??
          (content.supportPhone
            ? `Questions when you arrive? Call or text ${content.supportPhone}, or just reply to this email.`
            : "Questions when you arrive? Reply to this email and we'll point you in the right direction.");
        sections.push({ heading: "Who to ask for", body });
        break;
      }
    }
  }

  return sections;
}
