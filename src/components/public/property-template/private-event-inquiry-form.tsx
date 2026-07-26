"use client";

import { useState, useTransition, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { submitPrivateEventInquiryAction } from "@/app/(public)/horseshoe-bay/private-events/actions";
import { PropertyButton } from "./property-button";

const EVENT_TYPES = ["Corporate Events", "Group Shoots", "Celebrations", "Member Gatherings", "Other"];

const FIELD_LABEL = "font-property-sans text-xs uppercase text-property-ink/60";
const FIELD_INPUT =
  "w-full border-0 border-b border-property-ink/20 bg-transparent px-0 py-2 font-property-sans text-property-ink focus:border-property-accent focus:outline-none focus:ring-0";

// The Request a Proposal form (private-events.html) — submits into
// `inquiries` with inquiry_type='private_event'. Event type / desired
// date / guest count go into the `details` jsonb column, per the
// migration's documented shape. `submitVariant` defaults to "ink" (a
// stand-in for Horseshoe Bay's mockup, which actually specifies bg-moss —
// no "moss" button token exists, ink is the closest match already in use
// elsewhere on that page); Hog Heaven's mockup uses a literal accent
// button for this form, so its page passes submitVariant="primary".
export function PrivateEventInquiryForm({
  propertyId,
  submitVariant = "ink",
}: {
  propertyId: string;
  submitVariant?: "ink" | "primary";
}) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [desiredDate, setDesiredDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitPrivateEventInquiryAction({
        propertyId,
        fullName,
        email,
        eventType,
        desiredDate,
        guestCount,
        message,
        sourcePage: pathname,
      });
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setStatus("success");
      setFullName("");
      setEmail("");
      setEventType(EVENT_TYPES[0]);
      setDesiredDate("");
      setGuestCount("");
      setMessage("");
    });
  };

  if (status === "success") {
    return (
      <div className="border border-property-camel/40 bg-property-surface-lowest p-8 text-center">
        <p className="font-property-display text-xl uppercase text-property-ink">Thank you</p>
        <p className="mt-2 font-property-sans text-property-ink-variant">
          We&rsquo;ve received your proposal request and will follow up soon.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      {error && <p className="font-property-sans text-sm text-[#8b3030]">{error}</p>}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <label className={FIELD_LABEL}>Full Name</label>
          <input
            type="text"
            required
            placeholder="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={FIELD_INPUT}
          />
        </div>
        <div className="space-y-2">
          <label className={FIELD_LABEL}>Email Address</label>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD_INPUT}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <label className={FIELD_LABEL}>Event Type</label>
          <select
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            className={FIELD_INPUT}
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className={FIELD_LABEL}>Desired Date</label>
          <input
            type="date"
            value={desiredDate}
            onChange={(event) => setDesiredDate(event.target.value)}
            className={FIELD_INPUT}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className={FIELD_LABEL}>Guest Count</label>
        <input
          type="number"
          min={1}
          placeholder="Expected attendance"
          value={guestCount}
          onChange={(event) => setGuestCount(event.target.value)}
          className={FIELD_INPUT}
        />
      </div>
      <div className="space-y-2">
        <label className={FIELD_LABEL}>Your Message</label>
        <textarea
          rows={4}
          placeholder="Tell us about your event."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className={`resize-none ${FIELD_INPUT}`}
        />
      </div>
      <div className="pt-4 text-center">
        <PropertyButton type="submit" variant={submitVariant} disabled={isPending}>
          {isPending ? "Submitting…" : "Submit Inquiry"}
        </PropertyButton>
      </div>
    </form>
  );
}
