"use client";

import { useState, useTransition, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { submitMembershipInquiryAction } from "@/app/(public)/horseshoe-bay/membership/actions";
import { PropertyButton } from "./property-button";

const FIELD_LABEL = "font-property-sans text-[12px] uppercase tracking-widest text-property-accent-dark";
const FIELD_INPUT =
  "bg-property-surface-lowest border border-property-ink/10 p-4 font-property-sans text-property-ink focus:border-property-accent focus:outline-none focus:ring-1 focus:ring-property-accent";

const HEAR_ABOUT_US_OPTIONS = ["Referral", "Social Media", "Advertisement", "Other"];

// The Membership Inquiry form (membership.html) — submits into `inquiries`
// with inquiry_type='membership' via a thin Server Action. "How did you
// hear about us" is present on Hog Heaven's mockup but not Horseshoe
// Bay's, so it's opt-in via `showHearAboutUs` rather than always shown.
// `submitVariant` defaults to "ink" (Horseshoe Bay's mockup specifies
// bg-moss, no "moss" button token exists, ink is the closest match already
// used elsewhere on that page); Hog Heaven's mockup uses a literal accent
// button here, so its page passes submitVariant="primary".
export function MembershipInquiryForm({
  propertyId,
  showHearAboutUs = false,
  submitVariant = "ink",
  sourceLabel,
}: {
  propertyId: string;
  showHearAboutUs?: boolean;
  submitVariant?: "ink" | "primary";
  /** Human-readable description of which CTA opened this form, e.g. "Legacy Family" or "Schedule a Tour". Surfaced to admins so they know what the guest clicked, not just which property. */
  sourceLabel?: string;
}) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [hearAboutUs, setHearAboutUs] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitMembershipInquiryAction({
        propertyId,
        firstName,
        lastName,
        email,
        phone,
        message,
        hearAboutUs: hearAboutUs || undefined,
        sourcePage: pathname,
        sourceLabel,
      });
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setStatus("success");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setMessage("");
      setHearAboutUs("");
    });
  };

  if (status === "success") {
    return (
      <div className="border border-property-camel/40 bg-property-surface-lowest p-8 text-center">
        <p className="font-property-display text-xl uppercase text-property-ink">Thank you</p>
        <p className="mt-2 font-property-sans text-property-ink-variant">
          We&rsquo;ve received your inquiry and will be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2" onSubmit={handleSubmit}>
      {error && (
        <p className="md:col-span-2 font-property-sans text-sm text-[#8b3030]">{error}</p>
      )}
      <div className="flex flex-col gap-2">
        <label className={FIELD_LABEL}>First Name*</label>
        <input
          type="text"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          className={FIELD_INPUT}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className={FIELD_LABEL}>Last Name*</label>
        <input
          type="text"
          required
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          className={FIELD_INPUT}
        />
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <label className={FIELD_LABEL}>Email*</label>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={FIELD_INPUT}
        />
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <label className={FIELD_LABEL}>Phone Number*</label>
        <input
          type="tel"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className={`w-full ${FIELD_INPUT}`}
        />
      </div>
      {showHearAboutUs && (
        <div className="flex flex-col gap-2 md:col-span-2">
          <label className={FIELD_LABEL}>How did you hear about us?</label>
          <select
            value={hearAboutUs}
            onChange={(event) => setHearAboutUs(event.target.value)}
            className={FIELD_INPUT}
          >
            <option value="">Select an option</option>
            {HEAR_ABOUT_US_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2 md:col-span-2">
        <label className={FIELD_LABEL}>Additional info or questions</label>
        <textarea
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Let us know what you would like to learn about membership."
          className={FIELD_INPUT}
        />
      </div>
      <div className="mt-4 flex justify-end md:col-span-2">
        <PropertyButton type="submit" variant={submitVariant} disabled={isPending}>
          {isPending ? "Submitting…" : "Submit"}
        </PropertyButton>
      </div>
    </form>
  );
}
