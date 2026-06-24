// Customer confirmation for a submitted estimate request. Short + reassuring:
// "we've got it, our team will build your bid." No action link yet — the bid
// link comes later when staff send it. Same plain-React + inline-styles
// constraint as the sibling templates; prop shape is the contract with
// send-estimate-request-confirmation.ts.

export interface EstimateRequestConfirmationProps {
  contactName: string;
  propertyName: string | null; // null → generic "your outing"
  preferredDate: string; // e.g. "2026-08-15" or "—"
  indicativeTotal: string; // e.g. "$1,300" / "Coming Soon" / "—"
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_ACCENT = "#4a3f2a";
const COLOR_BORDER = "#e5dfd2";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function EstimateRequestConfirmation({
  contactName,
  propertyName,
  preferredDate,
  indicativeTotal,
}: EstimateRequestConfirmationProps) {
  const outingLabel = propertyName ?? "your outing";

  const rows: Array<[string, string]> = [
    ["Club", propertyName ?? "—"],
    ["Preferred date", preferredDate],
    ["Indicative", indicativeTotal],
  ];

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
                    <td style={{ padding: "28px 32px 8px" }}>
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
                        Rhythm Outdoors &middot; Estimate request
                      </p>
                      <h1
                        style={{
                          margin: "10px 0 0",
                          fontSize: "22px",
                          fontWeight: 600,
                          color: COLOR_INK,
                        }}
                      >
                        Thanks, {contactName} — we&rsquo;ve got it
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "12px 32px 0" }}>
                      <p style={{ margin: 0, fontSize: "15px", color: COLOR_INK }}>
                        Your request for {outingLabel} is in. Our team will build your bid and
                        send you a link to review, sign, and pay a deposit — no phone tag.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "20px 32px 8px" }}>
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
                          {rows.map(([label, value], index) => (
                            <tr key={label}>
                              <td
                                style={{
                                  padding: "10px 16px",
                                  fontSize: "12px",
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  color: COLOR_MUTED,
                                  fontWeight: 600,
                                  width: "128px",
                                  verticalAlign: "top",
                                  borderTop:
                                    index === 0 ? "none" : `1px solid ${COLOR_BORDER}`,
                                }}
                              >
                                {label}
                              </td>
                              <td
                                style={{
                                  padding: "10px 16px",
                                  fontSize: "15px",
                                  color: COLOR_INK,
                                  borderTop:
                                    index === 0 ? "none" : `1px solid ${COLOR_BORDER}`,
                                }}
                              >
                                {value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "16px 32px 32px" }}>
                      <p style={{ margin: 0, fontSize: "13px", color: COLOR_MUTED }}>
                        This is an indicative estimate only — final pricing is confirmed by our
                        team on the bid you&rsquo;ll sign. Questions? Just reply to this email.
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
