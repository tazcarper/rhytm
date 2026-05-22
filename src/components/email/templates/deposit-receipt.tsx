// Deposit-receipt email template — App 6 webhook handler.
//
// Fires when payment_intent.succeeded lands and the bid transitions to
// 'paid'. Two copy branches based on whether the waiver was already
// signed at the time of payment:
//   - signed:    "All set — we'll see you on <date>"
//   - unsigned:  "Deposit received — still need your waiver"
//
// Same plain-React + inline-styles approach as guest-booking-confirmation.
// Email clients don't honor <style> blocks or CSS modules; everything
// renders through style props. The shape of these props is the
// integration contract — if you change one, update the webhook handler
// (`handle-payment-intent-succeeded.ts`) too.
//
// No bid URL (deliberate). The bid page is gated by an access code that
// is bcrypt-hashed in the DB (Phase 3); we don't have the plaintext at
// webhook time. The receipt is a transaction record — the guest already
// has their original bid link from the App 2.9 confirmation email.

export interface DepositReceiptProps {
  guestName: string;
  propertyName: string;
  dateLong: string; // e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  depositAmount: string; // pre-formatted "500.00" — no $ prefix
  waiverSigned: boolean;
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_BORDER = "#e5dfd2";
const COLOR_SUCCESS_BG = "#eef3ec";
const COLOR_SUCCESS_INK = "#2d4a2d";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const serifStack =
  "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

export function DepositReceipt({
  guestName,
  propertyName,
  dateLong,
  timeLabel,
  depositAmount,
  waiverSigned,
}: DepositReceiptProps) {
  const headline = waiverSigned
    ? `We'll see you on ${dateLong}.`
    : "Deposit received.";

  const subhead = waiverSigned
    ? "Your deposit is in and your waiver is signed. Everything is set."
    : "Thanks for the deposit. One last step: sign your waiver on the bid page when you have a moment.";

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
                        Rhythm Outdoors &middot; Receipt
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
                          backgroundColor: COLOR_SUCCESS_BG,
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
                                  color: COLOR_SUCCESS_INK,
                                  fontWeight: 600,
                                }}
                              >
                                Paid
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
                                ${depositAmount}
                              </p>
                              <p
                                style={{
                                  margin: "8px 0 0",
                                  fontSize: "13px",
                                  color: COLOR_MUTED,
                                }}
                              >
                                Deposit toward your booking at{" "}
                                <strong>{propertyName}</strong>.
                              </p>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "16px 32px 0" }}>
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
                                When
                              </p>
                              <p
                                style={{
                                  margin: "4px 0 0",
                                  fontSize: "18px",
                                  fontWeight: 500,
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
                        Reach out anytime if you need anything before your visit
                        &mdash; reply to this email and the team will get back
                        to you within one business day.
                      </p>
                      <p
                        style={{
                          margin: "16px 0 0",
                          fontSize: "12px",
                          color: COLOR_MUTED,
                        }}
                      >
                        Keep this email for your records.
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

