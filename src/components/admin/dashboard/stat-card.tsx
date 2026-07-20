import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string;
  /** One line of context under the number — every stat gets a label. */
  hint: string;
  /** Where clicking the card takes you (the stat's source list). */
  href: string;
}

// KPI tile for the dashboard home. Serif number on paper, eyebrow label,
// one hint line — no deltas or sparklines until there's real history to
// compare against (see docs/dashboard-redesign-research.md on vanity
// metrics).
export function StatCard({ label, value, hint, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-card border border-rule bg-paper p-5 no-underline shadow-soft transition-all duration-fast hover:-translate-y-0.5 hover:border-tan hover:shadow-lift"
    >
      <span className="text-eyebrow font-semibold uppercase tracking-label text-gray">
        {label}
      </span>
      <span className="font-serif text-h2 font-semibold leading-none text-olive">
        {value}
      </span>
      <span className="text-micro text-gray">{hint}</span>
    </Link>
  );
}
