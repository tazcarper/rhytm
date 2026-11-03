"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/lib/ui";
import s from "./bid-editor-form.module.css";

// "Describe your event" — the AI helper's panel on the new-event screen.
// Framed as a form helper, not a chat window: one description in, maybe a
// follow-up question or two, then the staff member lands in the normal
// editor with a saved draft. Talks to /api/admin/event-helper.

type HelperResponse =
  | { kind: "question" | "capability" | "message"; sessionId: string; text: string }
  | { kind: "draft"; sessionId: string; eventId: string; eventCount: number }
  | { kind: "error"; sessionId?: string | null; text: string };

interface TranscriptLine {
  who: "you" | "helper";
  text: string;
}

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

      switch (result.kind) {
        case "draft":
          setTranscript((lines) => [
            ...lines,
            {
              who: "helper",
              text:
                result.eventCount > 1
                  ? `Saved ${result.eventCount} dates as drafts. Opening the first one in the editor…`
                  : "Draft saved. Opening it in the editor…",
            },
          ]);
          router.push(`/admin/events/${result.eventId}`);
          return;
        case "capability":
          setTranscript((lines) => [
            ...lines,
            {
              who: "helper",
              text: `The builder can't do that yet, so I've sent it to the developer as a feature request: "${result.text}". You can keep going, and I'll draft the rest of the event without it.`,
            },
          ]);
          break;
        case "question":
        case "message":
          setTranscript((lines) => [...lines, { who: "helper", text: result.text }]);
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
    <Card padding="default" elevation="soft" className="mb-6">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-label text-tan-deep">Describe your event</p>
        {transcript.length > 0 && (
          <button type="button" onClick={startOver} className="text-micro text-gray underline">
            Start over
          </button>
        )}
      </div>
      <p className="mt-1 text-[14px] text-gray">
        Write it the way you'd tell a coworker. The helper fills in a draft and asks about anything missing. Nothing is
        published until you publish it.
      </p>

      {transcript.length > 0 && (
        <ol className="mt-4 flex flex-col gap-2" aria-live="polite">
          {transcript.map((line, index) => (
            <li
              key={index}
              className={`rounded-sharp px-3 py-2 text-[14px] ${
                line.who === "you" ? "bg-paper text-olive" : "border border-rule text-olive"
              }`}
            >
              <span className="mr-2 text-micro uppercase tracking-label text-gray">
                {line.who === "you" ? "You" : "Helper"}
              </span>
              {line.text}
            </li>
          ))}
          {pending && <li className="px-3 py-2 text-[14px] text-gray">Working on it…</li>}
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
          rows={transcript.length > 0 ? 2 : 4}
          maxLength={4000}
          placeholder={transcript.length > 0 ? "Your answer" : PLACEHOLDER}
          disabled={pending}
        />
        <div>
          <Button type="submit" variant="primary" disabled={pending || !message.trim()}>
            {pending ? "Working…" : transcript.length > 0 ? "Send" : "Draft it"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
