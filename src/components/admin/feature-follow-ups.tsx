"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/ui";
import { loadFeatureChatAction, undoFeatureAction } from "@/app/admin/events/feature-request-actions";
import { EventHelperPanel, type TranscriptLine } from "./event-helper-panel";

// What staff can do with a feature that's live (Taz, 2026-11-10):
// - Add more: the helper chat opens (carrying on the conversation the
//   feature came from, when it's theirs), works out what to add, and puts
//   the feature back under Active to be built.
// - Undo this feature: Claude prepares taking everything that went live
//   for it off the site, on a test site first; it goes live when someone
//   publishes it, like any build.

type Mode = "idle" | "loading" | "adding" | "confirmUndo" | "undoStarted";

export function FeatureFollowUps({ requestId, canBuild }: { requestId: string; canBuild: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [chat, setChat] = useState<{ sessionId: string | null; transcript: TranscriptLine[] }>({
    sessionId: null,
    transcript: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openChat = () => {
    setError(null);
    setMode("loading");
    startTransition(async () => {
      const result = await loadFeatureChatAction({ id: requestId });
      if (!result.ok) {
        setError(result.error);
        setMode("idle");
        return;
      }
      setChat({ sessionId: result.sessionId, transcript: result.transcript });
      setMode("adding");
    });
  };

  const undo = () => {
    setError(null);
    startTransition(async () => {
      const result = await undoFeatureAction({ id: requestId });
      if (result.ok) {
        setMode("undoStarted");
        router.refresh();
      } else setError(result.error);
    });
  };

  if (!canBuild) return null;

  return (
    <div className="mt-6 max-w-[900px] border-t border-rule pt-5">
      {mode === "adding" ? (
        <EventHelperPanel
          propertyId={null}
          extendsRequestId={requestId}
          initialSessionId={chat.sessionId}
          initialTranscript={chat.transcript}
        />
      ) : mode === "confirmUndo" ? (
        <div className="flex flex-col gap-3 text-body text-olive">
          <p className="m-0 font-semibold text-olive-darker">Take this feature off the real site?</p>
          <p className="m-0 max-w-[70ch]">
            Claude removes everything that went live for it, including anything added later, and leaves other features
            alone. You&apos;ll try the result on a test site first; nothing changes on the real site until it&apos;s
            published. Events using this feature will lose it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" loading={isPending} onClick={undo}>
              Yes, start the undo
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      ) : mode === "undoStarted" ? (
        <p className="m-0 text-body text-olive-darker">
          Claude is preparing the undo. It&apos;s under Active now; try it there when it&apos;s ready.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" loading={mode === "loading"} onClick={openChat}>
            Add more
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("confirmUndo")}>
            Undo this feature
          </Button>
        </div>
      )}
      {error && <p className="m-0 mt-3 text-body font-semibold text-accent-error">{error}</p>}
    </div>
  );
}
