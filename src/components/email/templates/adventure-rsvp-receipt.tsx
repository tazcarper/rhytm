// Adventure RSVP receipt — sent from the Stripe webhook when an
// adventure payment clears and the RSVP flips to 'confirmed' (full
// payment at RSVP, Q14). Plain-React + inline styles, same approach as
// deposit-receipt.tsx (email clients ignore <style>/CSS modules). The
// prop shape is the integration contract — keep it in sync with
// handle-adventure-rsvp-succeeded.ts.

export interface AdventureRsvpReceiptProps {
  guestName: string;
  adventureTitle: string;
  propertyName: string;
  dateLabel: string; // e.g. "December 4–9, 2026"
  amountPaid: string; // pre-formatted "8,350" — no $ prefix
  balanceDue: string; // pre-formatted "0" when paid in full
  guestCount: number;
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_BORDER = "#e5dfd2";
const COLOR_SUCCESS_BG = "#eef3ec";
const COLOR_SUCCESS_INK = "#2d4a2d";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const serifStack = "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

export function AdventureRsvpReceipt({
  guestName,
  adventureTitle,
  propertyName,
  dateLabel,
  amountPaid,
  balanceDue,
  guestCount,
}: AdventureRsvpReceiptProps) {
  const partyLabel = `${guestCount} ${guestCount === 1 ? "guest" : "guests"}`;
  const hasBalance = balanceDue !== "0";

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
                        Rhythm Outdoors &middot; Adventure
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
                        You&rsquo;re going.
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "16px 32px 0" }}>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Hi {guestName},
                      </p>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Your place on <strong>{adventureTitle}</strong> is
                        confirmed for {partyLabel}. We&rsquo;ll be in touch with
                        the details as the dates approach.
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
                                {hasBalance ? "Deposit received" : "Paid in full"}
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
                                ${amountPaid}
                              </p>
                              <p
                                style={{
                                  margin: "8px 0 0",
                                  fontSize: "13px",
                                  color: COLOR_MUTED,
                                }}
                              >
                                Hosted by <strong>{propertyName}</strong> &middot;{" "}
                                {dateLabel}
                                {hasBalance && (
                                  <>
                                    {" "}
                                    &middot; ${balanceDue} balance settles with the
                                    concierge
                                  </>
                                )}
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
                      }}
                    >
                      <p
                        style={{ margin: 0, fontSize: "13px", color: COLOR_MUTED }}
                      >
                        Questions before the trip? Reply to this email and the
                        concierge will get back to you within one business day.
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
