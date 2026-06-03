// Waiver-signed email template — App 9 Inngest handler (`bid/signed`).
//
// Sent the moment a guest signs the liability waiver on their bid page.
// One template, two copy branches keyed on `finalized` (does signing
// complete the booking?):
//
//   - finalized=true  → "You're all set." The signature was the last
//     thing we needed: either a no-deposit bid, or a deposit bid whose
//     deposit was already paid (pay-then-sign). Terminal, no CTA. Shows
//     the at-property balance that settles on the day.
//   - finalized=false → "Waiver received." A deposit bid whose deposit
//     is still owed (sign-then-pay). The waiver is on file; the last step
//     is paying the deposit on the bid page — CTA points there.
//
// Why this is NOT driven off `booking/confirmed`: the sign-then-pay
// deposit path already gets the deposit-receipt email as its terminal
// "we'll see you" message, so finalizing off the booking event would
// double-send. Keying off `bid/signed` lets the signing moment own its
// own copy and avoids the overlap.
//
// Same plain-React + inline-styles constraint as the sibling templates —
// email clients don't honor <style> blocks or CSS modules. The prop shape
// is the integration contract with `send-waiver-signed-email.ts`.

export interface WaiverSignedProps {
  guestName: string;
  propertyName: string;
  dateLong: string; // e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  guestCount: number;
  // true = signing finalized the booking; false = deposit still owed.
  finalized: boolean;
  // finalized branch: amount that settles at the property on the day
  // (full total for a no-deposit bid, remaining balance for a paid
  // deposit). null hides the line (e.g. deposit covered the whole quote).
  atPropertyAmount: string | null; // pre-formatted whole dollars, no $ prefix
  // not-finalized branch: the deposit still owed, and the balance left
  // after it that settles at the property.
  depositAmount: string | null; // pre-formatted, no $ prefix
  balanceAfterDeposit: string | null; // pre-formatted, no $ prefix; null hides
  // Absolute bid-page URL for the "Pay your deposit" CTA (not-finalized
  // branch). null for legacy bids without a recovered access code — CTA is
  // replaced by "open the link from your original email" copy.
  bidUrl: string | null;
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_ACCENT = "#4a3f2a";
const COLOR_ACCENT_HOVER = "#332a1c";
const COLOR_BORDER = "#e5dfd2";
const COLOR_SUCCESS_BG = "#eef3ec";
const COLOR_SUCCESS_INK = "#2d4a2d";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const serifStack =
  "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

export function WaiverSigned({
  guestName,
  propertyName,
  dateLong,
  timeLabel,
  guestCount,
  finalized,
  atPropertyAmount,
  depositAmount,
  balanceAfterDeposit,
  bidUrl,
}: WaiverSignedProps) {
  const guestLine = guestCount === 1 ? "1 guest" : `${guestCount} guests`;

  const eyebrow = finalized
    ? "Rhythm Outdoors · Confirmed"
    : "Rhythm Outdoors · Waiver received";
  const headline = finalized ? "You’re all set." : "Waiver received.";

  const intro = finalized ? (
    <>
      Your waiver’s in and your visit to <strong>{propertyName}</strong> is
      confirmed. We’re looking forward to seeing you.
    </>
  ) : (
    <>
      Thanks &mdash; your waiver is on file for{" "}
      <strong>{propertyName}</strong>. One last step before your visit.
    </>
  );

  // The bid-page anchor phrase, with a fallback for legacy bids that have
  // no recovered URL (CTA button is hidden in that case).
  const onBidPage = bidUrl ? (
    "your bid page"
  ) : (
    <>
      your bid page (open the link from your first email &mdash;{" "}
      <em>&ldquo;We&rsquo;re preparing your bid&rdquo;</em>)
    </>
  );

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
                          color: COLOR_SUCCESS_INK,
                          fontWeight: 600,
                        }}
                      >
                        {eyebrow}
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
                        {intro}
                      </p>
                    </td>
                  </tr>

                  {/* When */}
                  <tr>
                    <td style={{ padding: "8px 32px 0" }}>
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
                              <p
                                style={{
                                  margin: "4px 0 0",
                                  fontSize: "14px",
                                  color: COLOR_MUTED,
                                }}
                              >
                                {guestLine}
                              </p>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Finalized: at-property balance note (terminal, no CTA) */}
                  {finalized && atPropertyAmount && (
                    <tr>
                      <td style={{ padding: "16px 32px 0" }}>
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
                                  At the property
                                </p>
                                <p
                                  style={{
                                    margin: "4px 0 0",
                                    fontSize: "16px",
                                    color: COLOR_INK,
                                  }}
                                >
                                  The <strong>${atPropertyAmount}</strong> settles
                                  when you arrive. Each additional guest signs a
                                  quick paper waiver at check-in.
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}

                  {/* Not finalized: deposit still owed + pay CTA */}
                  {!finalized && (
                    <tr>
                      <td style={{ padding: "24px 32px 0" }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "16px",
                          }}
                        >
                          <strong>Last step:</strong> pay your{" "}
                          {depositAmount ? <>${depositAmount} </> : null}deposit on{" "}
                          {onBidPage} to lock everything in.
                          {balanceAfterDeposit ? (
                            <>
                              {" "}
                              The remaining ${balanceAfterDeposit} settles at the
                              property.
                            </>
                          ) : null}
                        </p>
                      </td>
                    </tr>
                  )}

                  {!finalized && bidUrl && (
                    <tr>
                      <td style={{ padding: "24px 32px 8px" }}>
                        <table
                          role="presentation"
                          cellPadding={0}
                          cellSpacing={0}
                          border={0}
                        >
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  backgroundColor: COLOR_ACCENT,
                                  borderRadius: "2px",
                                }}
                              >
                                <a
                                  href={bidUrl}
                                  style={{
                                    display: "inline-block",
                                    padding: "14px 28px",
                                    color: "#ffffff",
                                    textDecoration: "none",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Pay your deposit
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {/* Bare-URL fallback for clients that strip styled
                            buttons. aria-hidden so screen readers don't
                            announce the same destination twice. */}
                        <p
                          aria-hidden="true"
                          style={{
                            margin: "16px 0 0",
                            fontSize: "13px",
                            color: COLOR_MUTED,
                            wordBreak: "break-all",
                          }}
                        >
                          Or paste this URL into your browser:
                          <br />
                          <a href={bidUrl} style={{ color: COLOR_ACCENT_HOVER }}>
                            {bidUrl}
                          </a>
                        </p>
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
                        Questions? Reply to this email and the team will get back
                        to you within one business day.
                      </p>
                      <p
                        style={{
                          margin: "16px 0 0",
                          fontSize: "12px",
                          color: COLOR_ACCENT,
                        }}
                      >
                        We&rsquo;re looking forward to having you out.
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
