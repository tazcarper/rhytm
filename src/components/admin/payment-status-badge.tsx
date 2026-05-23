import { Badge } from "@/lib/ui";
import type { BadgeVariant } from "@/lib/ui";

// Derived payment-status indicator. Surfaces "what kind of paid" next
// to the bid status — "Paid in full" vs "Deposit paid" vs "Partial
// payment" — for admins scanning the bids list and the bid detail page.
//
// Only renders when bid.status === 'paid'. Other statuses (refunded,
// confirmed, etc.) get their full meaning from BidStatusBadge alone.

export type PaymentStatusLabel =
  | "Paid in full"
  | "Deposit paid"
  | "Partial payment";

interface PaymentStatusBadgeInputs {
  amountPaid: number;
  depositAmount: number | null;
  effectiveQuote: number | null;
}

export function paymentStatusLabel({
  amountPaid,
  depositAmount,
  effectiveQuote,
}: PaymentStatusBadgeInputs): PaymentStatusLabel | null {
  if (amountPaid <= 0) return null;
  if (effectiveQuote !== null && amountPaid + 0.005 >= effectiveQuote) {
    return "Paid in full";
  }
  if (
    depositAmount !== null &&
    Math.abs(amountPaid - depositAmount) < 0.005
  ) {
    return "Deposit paid";
  }
  return "Partial payment";
}

const LABEL_TO_VARIANT: Record<PaymentStatusLabel, BadgeVariant> = {
  // Purple as a celebratory accent — they paid the entire quote.
  "Paid in full": "tierFounder",
  // Amber as the "balance still owed" family (matches pending_review's
  // sense of "waiting on something").
  "Deposit paid": "filling",
  "Partial payment": "filling",
};

export function PaymentStatusBadge({
  amountPaid,
  depositAmount,
  effectiveQuote,
}: PaymentStatusBadgeInputs) {
  const label = paymentStatusLabel({
    amountPaid,
    depositAmount,
    effectiveQuote,
  });
  if (!label) return null;
  return <Badge variant={LABEL_TO_VARIANT[label]}>{label}</Badge>;
}
