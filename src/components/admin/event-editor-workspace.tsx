"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { EventEditorForm, type EventSideTab } from "./event-editor-form";
import { EventHelperPanel, type TranscriptLine } from "./event-helper-panel";

type FormProps = Omit<ComponentProps<typeof EventEditorForm>, "helperPanel" | "sideTab" | "onSideTabChange">;

// A saved event's builder with the AI helper beside it, in a tab next to
// the live preview. The chat is the event's own conversation, so each draft
// keeps its history. When the helper changes the event, the page reloads
// its data and the builder starts again from what's now saved (its fields
// only read the saved event when they first appear).
export function EventEditorWorkspace({
  helper,
  initialSideTab = "preview",
  ...formProps
}: FormProps & {
  // Null hides the helper (roles that can't use it).
  helper: { propertyId: string; sessionId: string | null; transcript: ReadonlyArray<TranscriptLine> } | null;
  initialSideTab?: EventSideTab;
}) {
  const router = useRouter();
  const [sideTab, setSideTab] = useState<EventSideTab>(initialSideTab);
  // Bumped once fresh data arrives after the helper saved, to rebuild the
  // builder from it. A normal save in the builder doesn't rebuild it.
  const [version, setVersion] = useState(0);
  const [awaitingReload, setAwaitingReload] = useState(false);

  const reloadAfterHelper = () => {
    setAwaitingReload(true);
    router.refresh();
  };

  const { event, extras } = formProps;
  useEffect(() => {
    if (!awaitingReload) return;
    setAwaitingReload(false);
    setVersion((value) => value + 1);
    // Runs when the refreshed event data arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, extras]);

  return (
    <EventEditorForm
      key={version}
      {...formProps}
      sideTab={sideTab}
      onSideTabChange={setSideTab}
      helperPanel={
        helper ? (
          <EventHelperPanel
            propertyId={helper.propertyId}
            eventId={formProps.event.id}
            initialSessionId={helper.sessionId}
            initialTranscript={helper.transcript}
            onEventUpdated={reloadAfterHelper}
          />
        ) : undefined
      }
    />
  );
}
