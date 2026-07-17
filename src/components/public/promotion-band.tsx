import Link from "next/link";
import { Button } from "@/lib/ui";
import { MarkdownProse } from "@/src/components/shared/markdown";
import type { Promotion } from "@/src/services/public/promotions";

// Public promotion band. Renders the live promotions for a placement in the
// estate register — calm, confident, editorial. Deliberately NOT an OTA-style
// urgency strip (no countdowns, no "only N left"), per DESIGN.md. Renders
// nothing when there are no active promos, so callers can drop it in
// unconditionally.
export function PromotionBand({
  promotions,
}: {
  promotions: ReadonlyArray<Promotion>;
}) {
  if (promotions.length === 0) return null;

  return (
    <section aria-label="Featured offers" className="w-full bg-paper-warm">
      <div className="mx-auto flex max-w-content flex-col gap-6 px-6 py-12 md:py-16">
        {promotions.map((promotion) => (
          <PromotionCard key={promotion.id} promotion={promotion} />
        ))}
      </div>
    </section>
  );
}

function PromotionCard({ promotion }: { promotion: Promotion }) {
  const hasImage = Boolean(promotion.imageUrl);
  return (
    <article
      className={
        "grid items-center gap-6 rounded-card border border-rule bg-paper p-6 shadow-soft md:p-8 " +
        (hasImage ? "md:grid-cols-[1.4fr_1fr]" : "md:grid-cols-1")
      }
    >
      <div className="flex flex-col gap-3">
        {promotion.eyebrow && (
          <span className="text-eyebrow font-semibold uppercase tracking-eyebrow text-tan-deep">
            {promotion.eyebrow}
          </span>
        )}
        <h2 className="m-0 font-serif text-h3 leading-tight text-olive md:text-h2">
          {promotion.title}
        </h2>
        {promotion.body && (
          <MarkdownProse className="max-w-prose">
            {promotion.body}
          </MarkdownProse>
        )}
        {promotion.ctaLabel && promotion.ctaHref && (
          <div className="mt-1">
            <Button asChild variant="primary">
              <Link href={promotion.ctaHref}>{promotion.ctaLabel}</Link>
            </Button>
          </div>
        )}
      </div>

      {hasImage && (
        <div className="overflow-hidden rounded-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={promotion.imageUrl as string}
            alt=""
            className="h-full max-h-64 w-full object-cover"
          />
        </div>
      )}
    </article>
  );
}
