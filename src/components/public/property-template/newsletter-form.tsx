"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitNewsletterSignupAction } from "@/app/(public)/actions/newsletter";
import { PropertyButton } from "./property-button";

// Split out of PropertyFooter (a Server Component) because a DOM event
// handler like onSubmit can't be passed as a prop from server-rendered
// JSX — it has to originate inside a Client Component.
export function NewsletterForm({ propertySlug }: { propertySlug: string }) {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitNewsletterSignupAction({ propertySlug, email }, honeypot);
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setStatus("success");
      setEmail("");
    });
  };

  if (status === "success") {
    return (
      <p className="w-full font-property-sans text-property-body text-property-surface-lowest md:w-auto md:min-w-[440px]">
        Thanks for subscribing — watch your inbox for club news.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[440px]">
      {error && <p className="font-property-sans text-sm text-red-300">{error}</p>}
      <form className="flex w-full flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
        {/* Honeypot: hidden from real users, a bot's autofill trips it. */}
        <input
          type="text"
          name="company"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        <input
          type="email"
          required
          placeholder="Email Address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="flex-grow border border-property-surface-low/20 bg-transparent p-3 font-property-sans text-property-surface-lowest placeholder:text-property-surface-low/30 focus:border-property-camel focus:outline-none"
        />
        <PropertyButton type="submit" variant="primary" size="sm" disabled={isPending}>
          {isPending ? "Subscribing…" : "Subscribe"}
        </PropertyButton>
      </form>
    </div>
  );
}
