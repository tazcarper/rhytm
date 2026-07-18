"use client";

import { PropertyButton } from "./property-button";

// Split out of PropertyFooter (a Server Component) because a DOM event
// handler like onSubmit can't be passed as a prop from server-rendered
// JSX — it has to originate inside a Client Component. Intentionally
// non-functional for now (matches the mockups, which ship this same form
// unwired) — not in scope for this build.
export function NewsletterForm() {
  return (
    <form
      className="flex w-full flex-col gap-2 sm:flex-row md:w-auto md:min-w-[440px]"
      onSubmit={(event) => event.preventDefault()}
    >
      <input
        type="email"
        placeholder="Email Address"
        className="flex-grow border border-property-surface-low/20 bg-transparent p-3 font-property-sans text-property-surface-lowest placeholder:text-property-surface-low/30 focus:border-property-camel focus:outline-none"
      />
      <PropertyButton type="submit" variant="primary" size="sm">
        Subscribe
      </PropertyButton>
    </form>
  );
}
