// Bid-denied email template — App 9 (`bid/denied`).
//
// Sent when an admin declines a pending bid. Tone is courteous, not a hard
// "rejected": we couldn't confirm THIS request, and we'd still like to host
// them another time. The admin's optional denial reason is shown in a "note
// from the team" box when present.
//
// Same plain-React + inline-styles constraint as the sibling templates —
// email clients don't honor <style> blocks or CSS modules. The prop shape is
// the contract with send-bid-denied-email.ts.

export interface BidDeniedProps {
  guestName: string;
  propertyName: string;
  dateLong: string; // e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  // Admin-entered reason, or null to omit the note box.
  reason: string | null;
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_ACCENT = "#4a3f2a";
const COLOR_BORDER = "#e5dfd2";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const serifStack =
  "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

export function BidDenied({
  guestName,
  propertyName,
  dateLong,
  timeLabel,
  reason,
}: BidDeniedProps) {
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
                          color: COLOR_ACCENT,
                          fontWeight: 600,
                        }}
                      >
                        Rhythm Outdoors &middot; {propertyName}
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
                        About your booking request
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "16px 32px 0" }}>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Hi {guestName},
                      </p>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Thank you for your interest in {propertyName} on{" "}
                        <strong>
                          {dateLong} &middot; {timeLabel}
                        </strong>
                        . Unfortunately we&rsquo;re not able to confirm this
                        particular request.
                      </p>
                    </td>
                  </tr>

                  {reason && (
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
                                  A note from the team
                                </p>
                                <p
                                  style={{
                                    margin: "8px 0 0",
                                    fontSize: "16px",
                                    whiteSpace: "pre-line",
                                  }}
                                >
                                  {reason}
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td style={{ padding: "16px 32px 0" }}>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        We&rsquo;d still love to host you. Reply to this email or
                        send another request for a different date or time, and
                        we&rsquo;ll do our best to make it work.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style={{
                        padding: "16px 32px 32px",
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
                        We hope to see you out here soon.
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
