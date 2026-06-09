// Refund-notice email — App 6.6 admin refund flow.
//
// Sent when an admin issues a Stripe refund against a paid bid. Two
// copy branches based on whether the refund is partial:
//   - Full refund:    "Your deposit has been refunded — booking cancelled."
//   - Partial refund: "We've returned $X of your $Y deposit."
//
// Same plain-React + inline-styles approach as deposit-receipt /
// guest-booking-confirmation. The shape of these props is the
// integration contract — if you change one, update the refund service
// (`src/services/admin/refund-deposit.ts`) too.
//
// No CTA link — same rationale as deposit-receipt: we don't have the
// plaintext access code at refund time. The guest can reach back via
// reply-to if they have questions.

export interface RefundNoticeProps {
  guestName: string;
  propertyName: string;
  dateLong: string; // e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  depositAmount: string; // pre-formatted "500.00" — no $ prefix
  refundAmount: string; // pre-formatted "500.00" — no $ prefix
  isPartial: boolean;
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_BORDER = "#e5dfd2";
const COLOR_REFUND_BG = "#f5efe6";
const COLOR_REFUND_INK = "#5a3f1a";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const serifStack =
  "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

export function RefundNotice({
  guestName,
  propertyName,
  dateLong,
  timeLabel,
  depositAmount,
  refundAmount,
  isPartial,
}: RefundNoticeProps) {
  const headline = isPartial
    ? "Partial refund issued."
    : "Your deposit has been refunded.";

  const subhead = isPartial
    ? `We've returned $${refundAmount} of your $${depositAmount} deposit to your original payment method.`
    : `Your $${refundAmount} deposit has been returned to your original payment method, and the booking at ${propertyName} has been cancelled.`;

  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        backgroundColor: COLOR_PAPER,
        fontFamily: fontStack,
        color: COLOR_INK,
        lineHeight: 1.5,
      }}
    >
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        width="100%"
        style={{ backgroundColor: COLOR_PAPER, padding: "32px 16px" }}
      >
        <tbody>
          <tr>
            <td align="center">
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                border={0}
                width="100%"
                style={{
                  maxWidth: "560px",
                  backgroundColor: "#ffffff",
                  border: `1px solid ${COLOR_BORDER}`,
                  borderRadius: "4px",
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: "32px 32px 8px" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "11px",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: COLOR_MUTED,
                          fontWeight: 600,
                        }}
                      >
                        Rhythm Outdoors &middot; Refund notice
                      </p>
                      <h1
                        style={{
                          margin: "12px 0 0",
                          fontFamily: serifStack,
                          fontSize: "32px",
                          lineHeight: 1.15,
                          fontWeight: 500,
                          color: COLOR_INK,
                        }}
                      >
                        {headline}
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "16px 32px 0" }}>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Hi {guestName},
                      </p>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        {subhead}
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "8px 32px 8px" }}>
                      <table
                        role="presentation"
                        cellPadding={0}
                        cellSpacing={0}
                        border={0}
                        width="100%"
                        style={{
                          backgroundColor: COLOR_REFUND_BG,
                          border: `1px solid ${COLOR_BORDER}`,
                          borderRadius: "4px",
                        }}
                      >
                        <tbody>
                          <tr>
                            <td style={{ padding: "16px 20px" }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "11px",
                                  letterSpacing: "0.14em",
                                  textTransform: "uppercase",
                                  color: COLOR_REFUND_INK,
                                  fontWeight: 600,
                                }}
                              >
                                Refunded
                              </p>
                              <p
                                style={{
                                  margin: "4px 0 0",
                                  fontSize: "24px",
                                  fontWeight: 500,
                                  fontFamily: serifStack,
                                  color: COLOR_INK,
                                }}
                              >
                                ${refundAmount}
                              </p>
                              {isPartial && (
                                <p
                                  style={{
                                    margin: "8px 0 0",
                                    fontSize: "13px",
                                    color: COLOR_MUTED,
                                  }}
                                >
                                  Original deposit: ${depositAmount}
                                </p>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {!isPartial && (
                    <tr>
                      <td style={{ padding: "16px 32px 24px" }}>
                        <table
                          role="presentation"
                          cellPadding={0}
                          cellSpacing={0}
                          border={0}
                          width="100%"
                          style={{
                            backgroundColor: COLOR_PAPER,
                            border: `1px solid ${COLOR_BORDER}`,
                            borderRadius: "4px",
                          }}
                        >
                          <tbody>
                            <tr>
                              <td style={{ padding: "16px 20px" }}>
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: "11px",
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    color: COLOR_MUTED,
                                    fontWeight: 600,
                                  }}
                                >
                                  Cancelled booking
                                </p>
                                <p
                                  style={{
                                    margin: "4px 0 0",
                                    fontSize: "16px",
                                    fontWeight: 500,
                                  }}
                                >
                                  {propertyName}
                                </p>
                                <p
                                  style={{
                                    margin: "4px 0 0",
                                    fontSize: "14px",
                                    color: COLOR_MUTED,
                                  }}
                                >
                                  {dateLong} &middot; {timeLabel}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td
                      style={{
                        padding: "24px 32px 32px",
                        borderTop: `1px solid ${COLOR_BORDER}`,
                        marginTop: "16px",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: COLOR_MUTED,
                        }}
                      >
                        Refunds usually clear in 5&ndash;10 business days,
                        depending on your bank. Reply to this email if you
                        have questions or want to plan something else.
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
