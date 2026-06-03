// New-booking-request staff alert — App 9 (`bid/created`).
//
// Internal email to a property's booking-alert inbox the moment a guest
// submits a request, so staff know to review + confirm it (the bid lands in
// the admin queue as `pending_review`). Functional, not guest-branded: the
// key action is the "Review this request" button to the admin bid page.
//
// Same plain-React + inline-styles constraint as the sibling templates. The
// prop shape is the contract with send-new-bid-staff-notification.ts.

export interface NewBidStaffNotificationProps {
  propertyName: string;
  guestName: string;
  guestEmail: string;
  dateLong: string; // e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  guestCount: number;
  bookingTypeLabel: string; // humanized, e.g. "Private Lesson"
  reviewUrl: string; // absolute /admin/bids/<id> link
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_ACCENT = "#4a3f2a";
const COLOR_BORDER = "#e5dfd2";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function NewBidStaffNotification({
  propertyName,
  guestName,
  guestEmail,
  dateLong,
  timeLabel,
  guestCount,
  bookingTypeLabel,
  reviewUrl,
}: NewBidStaffNotificationProps) {
  const guestLine = guestCount === 1 ? "1 guest" : `${guestCount} guests`;

  const rows: Array<[string, string]> = [
    ["Guest", guestName],
    ["Email", guestEmail],
    ["Type", bookingTypeLabel],
    ["When", `${dateLong} · ${timeLabel}`],
    ["Party", guestLine],
    ["Property", propertyName],
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
                        New booking request &middot; {propertyName}
                      </p>
                      <h1
                        style={{
                          margin: "10px 0 0",
                          fontSize: "20px",
                          fontWeight: 600,
                          color: COLOR_INK,
                        }}
                      >
                        Review needed
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
                                  width: "92px",
                                  verticalAlign: "top",
                                  borderTop:
                                    index === 0
                                      ? "none"
                                      : `1px solid ${COLOR_BORDER}`,
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
                                    index === 0
                                      ? "none"
                                      : `1px solid ${COLOR_BORDER}`,
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
                                Review this request
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
