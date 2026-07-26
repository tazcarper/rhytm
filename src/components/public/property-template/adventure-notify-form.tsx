"use client";

// Split out of the Adventures page (a Server Component) because a DOM event
// handler like onSubmit can't be passed as a prop from server-rendered
// JSX — it has to originate inside a Client Component. Same pattern as
// NewsletterForm. Intentionally non-functional for now (matches the
// mockup, which ships this same form unwired) — not in scope for this build.
export function AdventureNotifyForm() {
  return (
    <form
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
      onSubmit={(event) => event.preventDefault()}
    >
      <input
        type="email"
        required
        placeholder="Email Address"
        className="flex-grow border border-property-ink/20 bg-property-surface-lowest p-4 font-property-sans text-property-ink placeholder:text-property-ink/40 focus:border-property-accent focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 bg-property-sage px-8 py-4 font-property-label text-[13px] font-semibold uppercase tracking-[0.1em] text-white transition-opacity duration-300 hover:opacity-90"
      >
        Notify Me
      </button>
    </form>
  );
}
