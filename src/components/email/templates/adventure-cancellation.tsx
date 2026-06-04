// Adventure cancellation confirmation — sent when a member (or staff)
// cancels an RSVP. Plain-React inline styles (same approach as
// deposit-receipt / refund-notice). Prop shape is the contract with
// cancel-adventure-rsvp.ts.

export interface AdventureCancellationProps {
  guestName: string;
  adventureTitle: string;
  refunded: boolean;
  refundAmount: string; // pre-formatted "6,850"
  forfeited: boolean; // paid but within the no-refund window
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_BORDER = "#e5dfd2";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const serifStack = "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

export function AdventureCancellation({
  guestName,
  adventureTitle,
  refunded,
  refundAmount,
  forfeited,
}: AdventureCancellationProps) {
  const line = refunded
    ? `We've refunded $${refundAmount} to your original payment method — it typically appears in 5–10 business days.`
    : forfeited
      ? "As this cancellation falls inside the adventure's cancellation window, the payment is non-refundable."
      : "No payment was on file, so there's nothing to refund.";

  return (
    <div style={{ margin: 0, padding: 0, backgroundColor: COLOR_PAPER, fontFamily: fontStack, color: COLOR_INK, lineHeight: 1.5 }}>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ backgroundColor: COLOR_PAPER, padding: "32px 16px" }}>
        <tbody>
          <tr>
            <td align="center">
              <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ maxWidth: "560px", backgroundColor: "#ffffff", border: `1px solid ${COLOR_BORDER}`, borderRadius: "4px" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "32px 32px 8px" }}>
                      <p style={{ margin: 0, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: COLOR_MUTED, fontWeight: 600 }}>
                        Rhythm Outdoors &middot; Cancellation
                      </p>
                      <h1 style={{ margin: "12px 0 0", fontFamily: serifStack, fontSize: "30px", lineHeight: 1.15, fontWeight: 500, color: COLOR_INK }}>
                        Your reservation is cancelled.
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "16px 32px 32px", fontSize: "16px" }}>
                      <p style={{ margin: "0 0 16px" }}>Hi {guestName},</p>
                      <p style={{ margin: "0 0 16px" }}>
                        We&rsquo;ve cancelled your reservation for{" "}
                        <strong>{adventureTitle}</strong>. {line}
                      </p>
                      <p style={{ margin: 0, fontSize: "14px", color: COLOR_MUTED }}>
                        Changed your mind? The adventure may still have space —
                        reach the concierge or reserve again from your members&rsquo; portal.
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
