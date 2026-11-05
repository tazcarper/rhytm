import Link from "next/link";
import { EVENT_PROTOTYPES } from "@/src/constants/admin/event-prototypes";

// The prototype list: one card per flow, plus the builder that's live today
// so it can be compared too.
export function PrototypeIndex() {
  return (
    <div className="font-sans text-[#1c2420]">
      <h1 className="m-0 text-[40px] font-bold leading-[1.1] tracking-[-0.02em]">Ways to create an event</h1>
      <p className="mb-10 mt-3 max-w-[60ch] text-[19px] leading-[1.55] text-[#4a5650]">
        Four clickable prototypes from the form research, each with its own look. They use sample data (a Thanksgiving
        Turkey Shoot at Horseshoe Bay) and don't save anything.
      </p>
      <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-2">
        {EVENT_PROTOTYPES.map((prototype, index) => (
          <li key={prototype.slug}>
            <Link
              href={`/admin/events/prototypes/${prototype.slug}`}
              className="flex h-full flex-col gap-3 rounded-[16px] border-2 border-[#d6ddd5] bg-white p-7 no-underline transition-colors hover:border-[#1f5b45]"
            >
              <span className="text-[15px] font-semibold text-[#4a5650]">
                {String.fromCharCode(65 + index)}. {prototype.pattern}
              </span>
              <span className="text-[26px] font-bold leading-[1.2] tracking-[-0.01em] text-[#1c2420]">{prototype.title}</span>
              <span className="text-[18px] leading-[1.5] text-[#1c2420]">{prototype.blurb}</span>
              <span className="mt-auto pt-2 text-[17px] leading-[1.5] text-[#4a5650]">
                <strong>Good for:</strong> {prototype.goodFor}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-[18px] text-[#4a5650]">
        Compare with what&apos;s live today:{" "}
        <Link href="/admin/events/new" className="underline">
          start screen and step-by-step builder
        </Link>
        .
      </p>
    </div>
  );
}
