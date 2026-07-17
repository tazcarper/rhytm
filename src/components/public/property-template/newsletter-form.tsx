"use client";

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
      <button
        type="submit"
        className="bg-property-accent px-8 py-3 font-property-sans text-[19px] font-bold uppercase tracking-[0.06em] text-property-ink transition-colors duration-300 hover:bg-property-accent-dark"
      >
        Subscribe
      </button>
    </form>
  );
}
