import type { ReminderSection } from "@/src/services/reminders/compose-sections";

// Pre-visit reminder email — App 9 W3 cadence. One flexible template the
// cadence engine reuses for every pre-event touch: the consolidated kickoff
// (many sections), the early/mid/final scheduled touches (fewer sections),
// all share this chrome. The engine supplies the headline, intro line, and
// the `sections` to render; this template only lays them out.
//
// Same plain-React + inline-styles constraint as the sibling templates —
// email clients don't honor <style> blocks or CSS modules. The prop shape
// is the contract with send-pre-event-cadence.ts.

export interface PreVisitProps {
  guestName: string;
  propertyName: string;
  dateLong: string; // e.g. "Saturday, May 23"
  timeLabel: string; // e.g. "9 AM CT"
  guestCount: number;
  headline: string; // e.g. "Getting ready for your visit"
  intro: string; // opening sentence after the greeting
  sections: ReminderSection[];
  // Absolute bid-page URL for a "view your full trip details" link, or null
  // for legacy bids without a recovered access code (link hidden).
  bidUrl: string | null;
  // Property's Google Maps share link, or null to omit the link.
  mapUrl: string | null;
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

export function PreVisit({
  guestName,
  propertyName,
  dateLong,
  timeLabel,
  guestCount,
  headline,
  intro,
  sections,
  bidUrl,
  mapUrl,
}: PreVisitProps) {
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

                  {/* Content sections */}
                  {sections.map((section, index) => (
                    <tr key={index}>
                      <td style={{ padding: "20px 32px 0" }}>
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
                          {section.heading}
                        </p>
                        {section.body && (
                          <p
                            style={{
                              margin: "8px 0 0",
                              fontSize: "16px",
                              whiteSpace: "pre-line",
                            }}
                          >
                            {section.body}
                          </p>
                        )}
                        {section.items && section.items.length > 0 && (
                          <ul
                            style={{
                              margin: "8px 0 0",
                              paddingLeft: "20px",
                              fontSize: "16px",
                            }}
                          >
                            {section.items.map((item, itemIndex) => (
                              <li
                                key={itemIndex}
                                style={{
                                  marginBottom:
                                    itemIndex === section.items!.length - 1
                                      ? "0"
                                      : "6px",
                                }}
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}

                  <tr>
                    <td
                      style={{
                        padding: "24px 32px 32px",
                        borderTop: `1px solid ${COLOR_BORDER}`,
                        marginTop: "16px",
                      }}
                    >
                      {mapUrl && (
                        <p style={{ margin: "0 0 16px", fontSize: "14px" }}>
                          <a href={mapUrl} style={{ color: COLOR_ACCENT }}>
                            Open in Google Maps &rarr;
                          </a>
                        </p>
                      )}
                      {bidUrl && (
                        <p style={{ margin: "0 0 16px", fontSize: "14px" }}>
                          <a href={bidUrl} style={{ color: COLOR_ACCENT }}>
                            View your full trip details &rarr;
                          </a>
                        </p>
                      )}
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
                        See you out there.
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
