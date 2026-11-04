"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/lib/ui";
import { removeAllEventsAction } from "@/app/admin/events/actions";

// TEMPORARY test cleanup (Taz, 2026-11-04). Shown on previews and local dev
// only; the action refuses on the live site too. Remove before launch.
export function RemoveAllEventsButton() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const result = await removeAllEventsAction(typed);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setMessage({ kind: "success", text: `Removed ${result.count} event${result.count === 1 ? "" : "s"}.` });
      setOpen(false);
      setTyped("");
    });

  return (
    <div className="flex flex-col items-end gap-2">
      {!open ? (
        <Button type="button" variant="ghost" onClick={() => { setOpen(true); setMessage(null); }}>
          Remove all events (test)
        </Button>
      ) : (
        <div className="flex max-w-[420px] flex-col gap-2 rounded-[10px] border border-accent-error bg-white p-3">
          <p className="m-0 text-[14px] text-olive-darker">
            Deletes every event and draft (not templates), with their sign-ups. Previews only. Type{" "}
            <strong>DELETE</strong> to confirm.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={typed}
              onChange={(evt) => setTyped(evt.target.value)}
              aria-label="Type DELETE to confirm"
              className="h-9 w-32 rounded-[6px] border border-rule-strong px-2 text-[14px]"
              autoFocus
            />
            <Button type="button" variant="primary" disabled={typed !== "DELETE" || isPending} onClick={remove}>
              {isPending ? "Removing…" : "Remove all"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); setTyped(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {message && (
        <Alert variant={message.kind} title={message.kind === "error" ? "Couldn't remove events" : "Done"}>
          {message.text}
        </Alert>
      )}
    </div>
  );
}
