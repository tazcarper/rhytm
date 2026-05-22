// Guest booking-confirmation email template — App 2.9 shim.
//
// Plain React + inline styles. Email clients don't honor <style> blocks or
// CSS modules consistently, so every visual rule lives in style props.
// App 8 swaps the renderer to @react-email/* (the same JSX shape will
// keep working since react-email components compile down to inline-styled
// tables) and swaps the transport to Resend. The shape of these props
// is the integration contract — if you change one, update the
// `LoggingEmailService.send()` caller in create-public-booking.ts too.
//
// Today's render path: react-dom/server.renderToStaticMarkup() →
// dev_email_outbox.body_html.

export interface GuestBookingConfirmationProps {
  guestName: string;
  propertyName: string;
  dateLong: string; // e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  bidUrl: string; // absolute URL (https://...) — built via buildAbsoluteBidUrl
}

// Brand colors hard-coded here rather than referencing CSS custom
// properties — inboxes don't resolve `var(--accent)`. Kept in lockstep
// with app/globals.css. Swap by find-replace if the palette shifts.
const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_ACCENT = "#4a3f2a";
const COLOR_ACCENT_HOVER = "#332a1c";
const COLOR_BORDER = "#e5dfd2";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const serifStack =
  "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

export function GuestBookingConfirmation({
  guestName,
  propertyName,
  dateLong,
  timeLabel,
  bidUrl,
}: GuestBookingConfirmationProps) {
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
        style={{
          backgroundColor: COLOR_PAPER,
          padding: "32px 16px",
        }}
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
                        Rhythm Outdoors
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
                        We&rsquo;re preparing your bid.
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "16px 32px 0" }}>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Hi {guestName},
                      </p>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Thanks for your booking request at{" "}
                        <strong>{propertyName}</strong>. Our team is reviewing
                        the details and will confirm your booking shortly.
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
                    <td style={{ padding: "24px 32px 8px" }}>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Your bid page is the single place to track this booking
                        from here on — schedule, gear list, signature, and
                        deposit will all surface there as we finalize.
                      </p>
                      <p style={{ margin: "0 0 24px", fontSize: "16px" }}>
                        Bookmark this link:
                      </p>
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
                                View your bid
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
                        <a
                          href={bidUrl}
                          style={{ color: COLOR_ACCENT_HOVER }}
                        >
                          {bidUrl}
                        </a>
                      </p>
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
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: COLOR_MUTED,
                        }}
                      >
                        Questions? Reply to this email and we&rsquo;ll get
                        back to you within one business day.
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
