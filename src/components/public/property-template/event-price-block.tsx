import { Clock } from "lucide-react";
import type { PublicEventEarlyBird } from "@/src/services/public/events";

// The price panel at the top of an event's sign-up card. While an
// early-bird price runs it follows the common ticketing pattern: a
// "Early-bird price" tag, the later price struck through next to today's
// price, and a deadline line ("Sign up by … to save $20") so the saving and
// its cut-off are read together.

interface EventPriceBlockProps {
  memberPrice: number | null;
  nonMemberPrice: number | null;
  /** Hide the non-member row (members-only events). */
  showNonMember: boolean;
  earlyBird: PublicEventEarlyBird | null;
  /** Members pay nothing because it's part of membership. */
  includedWithMembership: boolean;
}

function money(value: number | null): string {
  if (value === null || value === 0) return "Free";
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

function formatLastDay(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function saving(now: number | null, later: number | null): number {
  return later === null ? 0 : Math.max(0, later - (now ?? 0));
}

// "save $20", or "save $20 on the non-member price" when only one group saves.
function savingsText(rows: ReadonlyArray<{ label: string; save: number }>): string {
  const saving = rows.filter((row) => row.save > 0);
  if (saving.length === 0) return "";
  const most = Math.max(...saving.map((row) => row.save));
  if (saving.length === 1 && rows.length > 1) {
    return `save ${dollars(most)} on the ${saving[0].label.toLowerCase()} price`;
  }
  return new Set(saving.map((row) => row.save)).size === 1 ? `save ${dollars(most)}` : `save up to ${dollars(most)}`;
}

function dollars(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

function PriceRow({
  label,
  now,
  later,
  nowText,
}: {
  label: string;
  now: number | null;
  later: number | null;
  nowText?: string;
}) {
  const discounted = later !== null && saving(now, later) > 0;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-property-label text-[12px] uppercase tracking-widest text-property-ink-variant">{label}</span>
      <span className="flex items-baseline gap-3">
        {discounted && (
          <s className="font-property-sans text-lg text-property-ink-variant decoration-1" aria-label={`was ${money(later)}`}>
            {money(later)}
          </s>
        )}
        <span className="property-display font-property-display text-3xl text-property-ink">{nowText ?? money(now)}</span>
      </span>
    </div>
  );
}

export function EventPriceBlock({
  memberPrice,
  nonMemberPrice,
  showNonMember,
  earlyBird,
  includedWithMembership,
}: EventPriceBlockProps) {
  const rows = [
    { label: "Member", now: memberPrice, later: earlyBird?.memberPriceAfter ?? null },
    ...(showNonMember
      ? [{ label: "Non-member", now: nonMemberPrice, later: earlyBird?.nonMemberPriceAfter ?? null }]
      : []),
  ];
  const save = earlyBird ? savingsText(rows.map((row) => ({ label: row.label, save: saving(row.now, row.later) }))) : "";

  return (
    <div className="flex flex-col gap-4">
      {earlyBird && (
        <span className="self-start bg-property-accent px-3 py-1 font-property-label text-[11px] font-semibold uppercase tracking-widest text-property-on-primary">
          Early-bird price
        </span>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <PriceRow
            key={row.label}
            label={row.label}
            now={row.now}
            later={row.later}
            nowText={row.label === "Member" && includedWithMembership && !row.now ? "Included" : undefined}
          />
        ))}
      </div>
      {earlyBird && save && (
        <p className="flex items-start gap-2 border-l-2 border-property-accent bg-property-bg px-3 py-2 font-property-sans text-[15px] text-property-ink">
          <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-property-accent-dark" />
          <span>
            Sign up by <strong>{formatLastDay(earlyBird.lastDay)}</strong> to {save}.
          </span>
        </p>
      )}
    </div>
  );
}
