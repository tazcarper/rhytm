import { Card } from "@/lib/ui";
import { formatMoney } from "@/src/services/public/format";
import type { BidLineItem } from "@/src/services/bids/bid-line-items";
import s from "./bid-detail.module.css";

// Read-only itemized quote breakdown (Phase 0). Shows the materialized
// bid_line_items with a subtotal. The headline quote / deposit still come
// from the PricingEditor; this is the line-by-line view that Phase 1's
// per-line waive/comp overrides build on.
export function BidLineItemsCard({ lineItems }: { lineItems: BidLineItem[] }) {
  if (lineItems.length === 0) return null;

  const subtotal = lineItems.reduce((sum, l) => sum + l.lineAmount, 0);

  return (
    <Card padding="loose" elevation="soft" className={s.section}>
      <h2 className={s.sectionTitle}>Quote breakdown</h2>
      <ul className={s.lineItems}>
        {lineItems.map((line) => (
          <li key={line.id} className={s.lineItem}>
            <span className={s.lineItemLabel}>
              {line.label}
              {line.taxStatus === "exempt" && (
                <span className={s.lineItemTag}> · tax-exempt</span>
              )}
            </span>
            <span className={s.lineItemAmount}>${formatMoney(line.lineAmount)}</span>
          </li>
        ))}
        <li className={`${s.lineItem} ${s.lineItemSubtotal}`}>
          <span className={s.lineItemLabel}>Subtotal</span>
          <span className={s.lineItemAmount}>${formatMoney(subtotal)}</span>
        </li>
      </ul>
    </Card>
  );
}
