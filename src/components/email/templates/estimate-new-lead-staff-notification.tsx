// New-estimate-lead staff alert — emailed to a property's club-manager inbox
// the moment a customer (or staff on a phone call) submits an estimate
// request, so the manager knows a lead is waiting to be turned into a bid.
// Functional, not guest-branded: the key action is "Open this request" →
// the admin estimates detail page.
//
// Same plain-React + inline-styles constraint as the sibling templates. The
// prop shape is the contract with send-estimate-lead-staff-notification.ts.

export interface EstimateNewLeadStaffNotificationProps {
  propertyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  channelLabel: string; // "Member" / "Non-member" / "Public group" / "Partner"
  partyLine: string; // e.g. "2 members · 10 guest adults · 1 guest junior"
  experiencesLine: string; // e.g. "clays, lesson" or "—"
  preferredDate: string; // e.g. "2026-08-15" or "—"
  indicativeTotal: string; // e.g. "$1,300" / "Coming Soon" / "—"
  createdByLabel: string; // "self-serve" or the staff member's name
  reviewUrl: string; // absolute /admin/estimates/<id> link
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_ACCENT = "#4a3f2a";
const COLOR_BORDER = "#e5dfd2";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function EstimateNewLeadStaffNotification({
  propertyName,
  contactName,
  contactEmail,
  contactPhone,
  channelLabel,
  partyLine,
  experiencesLine,
  preferredDate,
  indicativeTotal,
  createdByLabel,
  reviewUrl,
}: EstimateNewLeadStaffNotificationProps) {
  const rows: Array<[string, string]> = [
    ["Contact", contactName],
    ["Email", contactEmail],
    ...(contactPhone ? ([["Phone", contactPhone]] as Array<[string, string]>) : []),
    ["Channel", channelLabel],
    ["Party", partyLine],
    ["Experiences", experiencesLine],
    ["Preferred", preferredDate],
    ["Indicative", indicativeTotal],
    ["Via", createdByLabel],
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
                        New estimate request &middot; {propertyName}
                      </p>
                      <h1
                        style={{
                          margin: "10px 0 0",
                          fontSize: "20px",
                          fontWeight: 600,
                          color: COLOR_INK,
                        }}
                      >
                        A lead is waiting
                      </h1>
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
                                  width: "104px",
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
                    <td style={{ padding: "24px 32px 32px" }}>
                      <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
                        <tbody>
                          <tr>
                            <td style={{ backgroundColor: COLOR_ACCENT, borderRadius: "2px" }}>
                              <a
                                href={reviewUrl}
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
                                Open this request
                              </a>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <p
                        aria-hidden="true"
                        style={{
                          margin: "16px 0 0",
                          fontSize: "13px",
                          color: COLOR_MUTED,
                          wordBreak: "break-all",
                        }}
                      >
                        {reviewUrl}
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
