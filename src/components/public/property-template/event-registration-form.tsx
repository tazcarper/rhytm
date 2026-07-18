"use client";

import { useState, useTransition, type FormEvent } from "react";
import { registerForEventAction } from "@/app/(public)/horseshoe-bay/events/[id]/actions";
import { PropertyButton } from "./property-button";

const FIELD_LABEL = "font-property-sans text-[12px] uppercase tracking-widest text-property-accent-dark";
const FIELD_INPUT =
  "bg-property-surface-lowest border border-property-ink/10 p-3 font-property-sans text-property-ink focus:border-property-accent focus:outline-none focus:ring-1 focus:ring-property-accent";

interface EventRegistrationFormProps {
  eventId: string;
  maxGuestsPerRegistration: number;
}

// Event signup form — capacity-tracking only, no payment (v1 scope). The
// Server Action resolves member pricing server-side and automatically
// falls back to the waitlist if the event is at capacity or manually
// marked sold out, so this component just needs to show whichever
// outcome comes back.
export function EventRegistrationForm({ eventId, maxGuestsPerRegistration }: EventRegistrationFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<"confirmed" | "waitlisted" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [guestCount, setGuestCount] = useState("1");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await registerForEventAction({
        eventId,
        contactName,
        contactEmail,
        contactPhone,
        guestCount: Number(guestCount) || 1,
      });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setResult(response.status);
    });
  };

  if (result === "confirmed") {
    return (
      <div className="border border-property-camel/40 bg-property-surface-lowest p-6 text-center">
        <p className="font-property-display text-xl uppercase text-property-ink">You&rsquo;re registered</p>
        <p className="mt-2 font-property-sans text-sm text-property-ink-variant">
          We&rsquo;ve confirmed your spot — a confirmation has been sent to {contactEmail}.
        </p>
      </div>
    );
  }

  if (result === "waitlisted") {
    return (
      <div className="border border-property-accent/40 bg-property-surface-lowest p-6 text-center">
        <p className="font-property-display text-xl uppercase text-property-ink">You&rsquo;re on the waitlist</p>
        <p className="mt-2 font-property-sans text-sm text-property-ink-variant">
          This event is at capacity. We&rsquo;ll reach out at {contactEmail} the moment a spot opens up.
        </p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {error && <p className="font-property-sans text-sm text-[#8b3030]">{error}</p>}
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Name*</span>
        <input
          type="text"
          required
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          className={FIELD_INPUT}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Email*</span>
        <input
          type="email"
          required
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          className={FIELD_INPUT}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>Phone</span>
        <input
          type="tel"
          value={contactPhone}
          onChange={(event) => setContactPhone(event.target.value)}
          className={FIELD_INPUT}
        />
      </label>
      {maxGuestsPerRegistration > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Guests (including you)</span>
          <input
            type="number"
            min={1}
            max={maxGuestsPerRegistration}
            value={guestCount}
            onChange={(event) => setGuestCount(event.target.value)}
            className={FIELD_INPUT}
          />
          <span className="font-property-sans text-xs text-property-ink/50">
            Up to {maxGuestsPerRegistration} per registration.
          </span>
        </label>
      )}
      <PropertyButton type="submit" variant="ink" disabled={isPending} className="mt-2">
        {isPending ? "Submitting…" : "Register"}
      </PropertyButton>
    </form>
  );
}
