"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/lib/ui";
import { FlowButton as Button } from "./event-flow-button";
import s from "./event-flow.module.css";

// "Describe your event" — the AI helper's panel on the new-event screen.
// Framed as a form helper, not a chat window: one description in, maybe a
// follow-up question or two, then the staff member lands in the normal
// editor with a saved draft. Talks to /api/admin/event-helper.

type HelperResponse =
  | { kind: "question" | "message"; sessionId: string; text: string; featureRequest?: string }
  | { kind: "capability"; sessionId: string; text: string }
  | { kind: "draft"; sessionId: string; eventId: string; eventCount: number; featureRequest?: string }
  | { kind: "error"; sessionId?: string | null; text: string };

interface TranscriptLine {
  who: "you" | "helper";
  text: string;
  // A link under the text (the saved draft, when it isn't opened right away).
  link?: { href: string; label: string };
}

const featureRequestLine = (summary: string): TranscriptLine => ({
  who: "helper",
  text: `The builder can't do that yet, so I've sent it to the developer as a feature request: "${summary}". I've drafted the rest of the event without it.`,
});

const PLACEHOLDER =
  "e.g. Halloween party on Oct 31, 8 a.m. to 4 p.m. $50 adults, $10 kids. Hayride, pumpkin carving and a costume contest.";

export function EventHelperPanel({ propertyId }: { propertyId: string | null }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    const text = message.trim();
    if (!text || pending) return;

    setError(null);
    setPending(true);
    setTranscript((lines) => [...lines, { who: "you", text }]);
    setMessage("");

    try {
      const response = await fetch("/api/admin/event-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text, propertyId }),
      });
      const result = (await response.json()) as HelperResponse;
      if (result.sessionId) setSessionId(result.sessionId);
      const note = "featureRequest" in result && result.featureRequest ? [featureRequestLine(result.featureRequest)] : [];

      switch (result.kind) {
        case "draft": {
          const saved = result.eventCount > 1 ? `Saved ${result.eventCount} dates as drafts.` : "Draft saved.";
          const href = `/admin/events/${result.eventId}`;
          if (note.length > 0) {
            // Stay here so the feature-request note can be read; the draft is a tap away.
            setTranscript((lines) => [
              ...lines,
              ...note,
              { who: "helper", text: `${saved} Review it in the editor, then publish when it's ready.`, link: { href, label: "Open the draft" } },
            ]);
            break;
          }
          setTranscript((lines) => [
            ...lines,
            {
              who: "helper",
              text: result.eventCount > 1 ? `${saved} Opening the first one in the editor…` : `${saved} Opening it in the editor…`,
            },
          ]);
          router.push(href);
          return;
        }
        case "capability":
          setTranscript((lines) => [
            ...lines,
            {
              who: "helper",
              text: `The builder can't do that yet, so I've sent it to the developer as a feature request: "${result.text}". Tell me anything else about the event and I'll draft it without that part.`,
            },
          ]);
          break;
        case "question":
        case "message":
          setTranscript((lines) => [...lines, ...note, { who: "helper", text: result.text }]);
          break;
        case "error":
          setError(result.text);
          break;
      }
    } catch {
      setError("Couldn't reach the helper. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const startOver = () => {
    setSessionId(null);
    setTranscript([]);
    setError(null);
    setMessage("");
  };

  return (
    <div className={`${s.panel} ${s.flow} flex flex-col`}>
      <div className="flex items-center justify-between gap-4">
        <h2 className={s.subhead}>Or just describe it</h2>
        {transcript.length > 0 && (
          <button type="button" onClick={startOver} className="text-[15px] text-gray underline">
            Start over
          </button>
        )}
      </div>
      <p className="mt-1 text-[17px] leading-[1.5] text-gray">
        Tell the helper about the event the way you'd tell a coworker. It fills in a draft for you and asks about
        anything missing. Nothing goes live until you publish.
      </p>

      {transcript.length > 0 && (
        <ol className="m-0 mt-5 flex list-none flex-col gap-3 p-0" aria-live="polite">
          {transcript.map((line, index) => (
            <li key={index} className={`flex ${line.who === "you" ? "justify-end" : "justify-start"}`}>
              <span
                className={`max-w-[90%] rounded-[16px] px-4 py-3 text-[17px] leading-[1.45] ${
                  line.who === "you"
                    ? "rounded-br-[4px] bg-olive text-white"
                    : "rounded-bl-[4px] bg-paper-warm text-olive-darker"
                }`}
              >
                <span className="sr-only">{line.who === "you" ? "You: " : "Helper: "}</span>
                {line.text}
                {line.link && (
                  <a href={line.link.href} className="mt-2 block font-semibold text-olive underline">
                    {line.link.label}
                  </a>
                )}
              </span>
            </li>
          ))}
          {pending && (
            <li className="flex justify-start">
              <span className="rounded-[16px] rounded-bl-[4px] bg-paper-warm px-4 py-3 text-[17px] text-gray">
                Working on it…
              </span>
            </li>
          )}
        </ol>
      )}

      {error && (
        <Alert variant="error" title="Helper problem">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
        <textarea
          value={message}
          onChange={(evt) => setMessage(evt.target.value)}
          className={s.input}
          rows={transcript.length > 0 ? 2 : 5}
          maxLength={4000}
          placeholder={transcript.length > 0 ? "Your answer" : PLACEHOLDER}
          disabled={pending}
          onKeyDown={(evt) => {
            // Enter sends; Shift+Enter adds a new line.
            if (evt.key === "Enter" && !evt.shiftKey) {
              evt.preventDefault();
              evt.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div>
          <Button type="submit" variant="primary" disabled={pending || !message.trim()}>
            {pending ? "Working…" : transcript.length > 0 ? "Send" : "Draft it"}
          </Button>
        </div>
      </form>
    </div>
  );
}
