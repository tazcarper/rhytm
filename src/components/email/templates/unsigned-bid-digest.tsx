// Unsigned-bid staff digest — App 9 W2.
//
// One consolidated email per property: the confirmed bids that have been
// awaiting the guest's signature past the threshold (default 48h). Lists up
// to a cap; any beyond it collapse into an "and N more" link to the admin
// bids queue. Internal/functional tone, like the new-bid alert.
//
// Same plain-React + inline-styles constraint as the sibling templates. The
// prop shape is the contract with send-unsigned-bid-digest.ts.

export interface UnsignedDigestBid {
  guestName: string;
  dateLong: string; // event date, e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  waitingLabel: string; // e.g. "3 days waiting"
  reviewUrl: string; // absolute /admin/bids/<id> link
}

export interface UnsignedBidDigestProps {
  propertyName: string;
  bids: UnsignedDigestBid[]; // already capped to the display limit
  overflowCount: number; // bids beyond the cap (0 = none)
  bidsIndexUrl: string; // absolute /admin/bids link for "and N more"
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_ACCENT = "#4a3f2a";
const COLOR_BORDER = "#e5dfd2";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function UnsignedBidDigest({
  propertyName,
  bids,
  overflowCount,
  bidsIndexUrl,
}: UnsignedBidDigestProps) {
  const countLabel =
    bids.length + overflowCount === 1
      ? "1 bid is still waiting on a signature"
      : `${bids.length + overflowCount} bids are still waiting on a signature`;

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
                    <td style={{ padding: "28px 32px 4px" }}>
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
                        Follow-up needed &middot; {propertyName}
                      </p>
                      <h1
                        style={{
                          margin: "10px 0 0",
                          fontSize: "20px",
                          fontWeight: 600,
                          color: COLOR_INK,
                        }}
                      >
                        {countLabel}
                      </h1>
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: "14px",
                          color: COLOR_MUTED,
                        }}
                      >
                        Confirmed, but the guest hasn&rsquo;t signed their waiver
                        yet. A nudge from the team often does it.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "16px 32px 8px" }}>
                      <table
                        role="presentation"
                        cellPadding={0}
                        cellSpacing={0}
                        border={0}
                        width="100%"
                        style={{
                          border: `1px solid ${COLOR_BORDER}`,
                          borderRadius: "4px",
                        }}
                      >
                        <tbody>
                          {bids.map((bid, index) => (
                            <tr key={bid.reviewUrl}>
                              <td
                                style={{
                                  padding: "12px 16px",
                                  borderTop:
                                    index === 0
                                      ? "none"
                                      : `1px solid ${COLOR_BORDER}`,
                                }}
                              >
                                <p style={{ margin: 0, fontSize: "15px" }}>
                                  <a
                                    href={bid.reviewUrl}
                                    style={{
                                      color: COLOR_INK,
                                      fontWeight: 600,
                                      textDecoration: "none",
                                    }}
                                  >
                                    {bid.guestName}
                                  </a>
                                </p>
                                <p
                                  style={{
                                    margin: "2px 0 0",
                                    fontSize: "13px",
                                    color: COLOR_MUTED,
                                  }}
                                >
                                  {bid.dateLong} &middot; {bid.timeLabel}
                                  {" · "}
                                  {bid.waitingLabel}
                                </p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {overflowCount > 0 && (
                    <tr>
                      <td style={{ padding: "8px 32px 24px" }}>
                        <p style={{ margin: 0, fontSize: "14px" }}>
                          <a href={bidsIndexUrl} style={{ color: COLOR_ACCENT }}>
                            &hellip; and {overflowCount} more &rarr;
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
                        Each name links to its bid in the admin dashboard.
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
