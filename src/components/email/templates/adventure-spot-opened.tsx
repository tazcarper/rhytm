// Waitlist "a spot opened" email — sent to each waitlisted member when a
// seat frees on an adventure they're queued for. Plain-React inline styles.
// Prop shape is the contract with notify-adventure-waitlist.ts.

export interface AdventureSpotOpenedProps {
  guestName: string;
  adventureTitle: string;
  propertyName: string;
  reserveUrl: string;
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_BORDER = "#e5dfd2";
const COLOR_OLIVE = "#3f4a21";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const serifStack = "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

export function AdventureSpotOpened({
  guestName,
  adventureTitle,
  propertyName,
  reserveUrl,
}: AdventureSpotOpenedProps) {
  return (
    <div style={{ margin: 0, padding: 0, backgroundColor: COLOR_PAPER, fontFamily: fontStack, color: COLOR_INK, lineHeight: 1.5 }}>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ backgroundColor: COLOR_PAPER, padding: "32px 16px" }}>
        <tbody>
          <tr>
            <td align="center">
              <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{ maxWidth: "560px", backgroundColor: "#ffffff", border: `1px solid ${COLOR_BORDER}`, borderRadius: "4px" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "32px 32px 8px" }}>
                      <p style={{ margin: 0, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: COLOR_MUTED, fontWeight: 600 }}>
                        {propertyName} &middot; Waitlist
                      </p>
                      <h1 style={{ margin: "12px 0 0", fontFamily: serifStack, fontSize: "30px", lineHeight: 1.15, fontWeight: 500, color: COLOR_INK }}>
                        A spot just opened.
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "16px 32px 8px", fontSize: "16px" }}>
                      <p style={{ margin: "0 0 16px" }}>Hi {guestName},</p>
                      <p style={{ margin: "0 0 16px" }}>
                        Good news — a place has opened on <strong>{adventureTitle}</strong>. Spots are
                        first come, first served, so reserve yours now before it&rsquo;s taken again.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "8px 32px 32px" }}>
                      <a href={reserveUrl} style={{ display: "inline-block", backgroundColor: COLOR_OLIVE, color: "#ffffff", textDecoration: "none", fontSize: "14px", fontWeight: 600, padding: "12px 24px", borderRadius: "4px" }}>
                        Reserve your spot
                      </a>
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
