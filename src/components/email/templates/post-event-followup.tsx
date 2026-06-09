// Post-event follow-up email — App 9 W3 cadence (T+1).
//
// Sent the day after the visit: a short thank-you. For public (non-member)
// guests it can carry a soft membership CTA — but that's gated behind the
// `membership_cta_enabled` setting (default off until Q15b is confirmed),
// so the engine only passes membershipCtaUrl when the flag is on.
//
// Same plain-React + inline-styles constraint as the sibling templates.

export interface PostEventFollowupProps {
  guestName: string;
  propertyName: string;
  dateLong: string; // the visit date, e.g. "Saturday, May 23"
  // Non-null only when the membership CTA is enabled — renders the CTA block.
  membershipCtaUrl: string | null;
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_ACCENT = "#4a3f2a";
const COLOR_BORDER = "#e5dfd2";
const COLOR_SUCCESS_BG = "#eef3ec";
const COLOR_SUCCESS_INK = "#2d4a2d";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const serifStack =
  "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

export function PostEventFollowup({
  guestName,
  propertyName,
  dateLong,
  membershipCtaUrl,
}: PostEventFollowupProps) {
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
                        Thanks for coming out.
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "16px 32px 0" }}>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        Hi {guestName},
                      </p>
                      <p style={{ margin: "0 0 16px", fontSize: "16px" }}>
                        It was great having you at {propertyName} on {dateLong}.
                        We hope it was a good day out. If anything stood out
                        &mdash; good or bad &mdash; just reply; we read every
                        note.
                      </p>
                    </td>
                  </tr>

                  {membershipCtaUrl && (
                    <tr>
                      <td style={{ padding: "8px 32px 24px" }}>
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
                                  Come back more often
                                </p>
                                <p
                                  style={{
                                    margin: "8px 0 0",
                                    fontSize: "16px",
                                  }}
                                >
                                  If you&rsquo;re thinking about making this a
                                  habit, membership opens up priority booking and
                                  member rates.{" "}
                                  <a
                                    href={membershipCtaUrl}
                                    style={{ color: COLOR_ACCENT }}
                                  >
                                    See what&rsquo;s included &rarr;
                                  </a>
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
                          fontSize: "12px",
                          color: COLOR_ACCENT,
                        }}
                      >
                        Until next time.
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
