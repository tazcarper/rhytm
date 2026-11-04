import Link from "next/link";
import type { ReactNode } from "react";
import { EVENT_PROTOTYPES, type EventPrototypeSlug } from "@/src/constants/admin/event-prototypes";

// Frame around each prototype: a "sample data, nothing is saved" banner and
// links to the other prototypes so they're quick to compare.
export function PrototypeShell({ slug, children }: { slug: EventPrototypeSlug; children: ReactNode }) {
  const current = EVENT_PROTOTYPES.find((prototype) => prototype.slug === slug);
  return (
    <div className="font-sans text-[#1c2420]">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[12px] bg-[#fff6dc] px-5 py-4 text-[16px]">
        <span>
          <strong>Prototype:</strong> {current?.title}. Sample data only, nothing is saved.
        </span>
        <nav aria-label="Other prototypes" className="flex flex-wrap gap-2">
          <Link href="/admin/events/prototypes" className="underline">
            All prototypes
          </Link>
          {EVENT_PROTOTYPES.filter((prototype) => prototype.slug !== slug).map((prototype) => (
            <Link key={prototype.slug} href={`/admin/events/prototypes/${prototype.slug}`} className="underline">
              {prototype.title}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

export function money(value: number): string {
  return value === 0 ? "Free" : `$${value}`;
}
