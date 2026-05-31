import type { ReactNode } from "react";

// Shared presentational shell for the two bid-confirmed emails
// (with-deposit / no-deposit). Holds everything the two variants render
// identically: header, when-box, pricing-box, the "What's next" ordered
// list, the bid-page CTA, and the footer. The variants supply only the
// copy that actually differs (intro line, pricing detail line, the step
// items, CTA label).
//
// Why a shared layout instead of two full templates: the table chrome is
// ~300 lines of inline-styled markup that must stay byte-identical for
// inbox rendering. Duplicating it means every future style tweak has to
// be applied twice and they drift. One shell + two thin callers keeps
// the Single-Responsibility split (each template owns its copy) without
// the duplication.
//
// Same plain-React + inline-styles constraint as the other email
// templates — email clients don't honor <style> blocks or CSS modules.

export interface BidConfirmedLayoutProps {
  guestName: string;
  propertyName: string;
  dateLong: string; // e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  guestCount: number;
  totalPrice: string; // pre-formatted whole dollars, no $ prefix
  // Absolute URL to the bid page (https://...). Null for legacy bids
  // created before access_code_plaintext was stored — CTA is hidden and
  // the variant's step copy points the guest at their original email.
  bidUrl: string | null;
  // Opening sentence after the greeting — differs by variant (number of
  // remaining steps).
  intro: string;
  // Rendered inside the pricing box beneath the total. Null = show the
  // total only (no-deposit variant).
  pricingDetail: ReactNode | null;
  // Ordered "What's next" items. Each entry is one <li> body.
  steps: ReactNode[];
  // Label for the bid-page CTA button (e.g. "Sign your waiver").
  ctaLabel: string;
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

export function BidConfirmedLayout({
  guestName,
  propertyName,
  dateLong,
  timeLabel,
  guestCount,
  totalPrice,
  bidUrl,
  intro,
  pricingDetail,
  steps,
  ctaLabel,
}: BidConfirmedLayoutProps) {
  const guestLine = guestCount === 1 ? "1 guest" : `${guestCount} guests`;

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
                        Rhythm Outdoors &middot; Confirmed
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
                        Your bid is confirmed.
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "16px 32px 0" }}>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Hi {guestName},
                      </p>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Good news — your visit to{" "}
                        <strong>{propertyName}</strong> is confirmed. {intro}
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

                  {/* Pricing */}
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
                                Total
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
                                ${totalPrice}
                              </p>
                              {pricingDetail}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Next steps */}
                  <tr>
                    <td style={{ padding: "24px 32px 0" }}>
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
                        What&rsquo;s next
                      </p>
                      <ol
                        style={{
                          margin: "12px 0 0",
                          paddingLeft: "20px",
                          fontSize: "16px",
                        }}
                      >
                        {steps.map((step, index) => (
                          <li
                            key={index}
                            style={{
                              marginBottom:
                                index === steps.length - 1 ? "0" : "12px",
                            }}
                          >
                            {step}
                          </li>
                        ))}
                      </ol>
                    </td>
                  </tr>

                  {bidUrl && (
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
                                  {ctaLabel}
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
                        {bidUrl ? (
                          <>
                            Questions? Reply to this email and the team will get
                            back to you within one business day.
                          </>
                        ) : (
                          <>
                            Can&rsquo;t find the original bid email? Reply to
                            this message and we&rsquo;ll resend the link.
                            Questions of any kind go to the same place &mdash;
                            the team replies within one business day.
                          </>
                        )}
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

// Shared muted/strong inline styles for the variant step + pricing copy.
export const CONFIRMED_COLOR_INK = COLOR_INK;
export const CONFIRMED_COLOR_MUTED = COLOR_MUTED;
