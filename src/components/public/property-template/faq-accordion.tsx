import { ChevronDown } from "lucide-react";
import { RuleDivider } from "./rule-divider";

export interface FaqEntry {
  question: string;
  answer: string | string[];
}

export interface FaqCategory {
  id: string;
  title: string;
  entries: FaqEntry[];
}

// One FAQ category: heading, rule, and a list of native <details>/<summary>
// rows — collapsed by default, works with no JavaScript, keyboard
// operable, and browser find-in-page still reaches text inside a closed
// row in modern browsers. Matches the mockup's own accessible pattern
// exactly (temporary-resources/front-end-beta/horseshoe-bay/faq.html).
export function FaqCategorySection({ category }: { category: FaqCategory }) {
  return (
    <section id={category.id} className="mb-16 scroll-mt-40">
      <h2 className="property-headline font-property-display text-[28px] uppercase text-property-ink">
        {category.title}
      </h2>
      <RuleDivider />
      <div className="border-b border-property-ink/15">
        {category.entries.map((entry) => (
          <details key={entry.question} className="group border-t border-property-ink/15">
            <summary className="flex list-none cursor-pointer items-start gap-6 py-5">
              <span className="flex-1 font-property-sans text-[17px] font-semibold leading-snug text-property-ink transition-colors group-hover:text-property-accent-dark">
                {entry.question}
              </span>
              <ChevronDown className="mt-0.5 size-5 shrink-0 text-property-ink-variant transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="max-w-3xl pb-7 pr-10">
              {(Array.isArray(entry.answer) ? entry.answer : [entry.answer]).map((paragraph) => (
                <p key={paragraph} className="mb-4 font-property-sans text-property-body text-property-ink-variant last:mb-0">
                  {paragraph}
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
