// Staff alert — a member requested an inquire-mode adventure. Plain-React
// inline styles (same approach as new-bid-staff-notification.tsx). Prop
// shape is the contract with send-adventure-request-notification.ts.

export interface AdventureRequestNotificationProps {
  propertyName: string;
  adventureTitle: string;
  guestName: string;
  guestCount: number;
  reviewUrl: string;
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_BORDER = "#e5dfd2";
const COLOR_OLIVE = "#3f4a21";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const serifStack = "'Cormorant Garamond', 'Times New Roman', Georgia, serif";

export function AdventureRequestNotification({
  propertyName,
  adventureTitle,
  guestName,
  guestCount,
  reviewUrl,
}: AdventureRequestNotificationProps) {
  const party = `${guestCount} ${guestCount === 1 ? "guest" : "guests"}`;
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
                        {propertyName} &middot; Adventure request
                      </p>
                      <h1 style={{ margin: "12px 0 0", fontFamily: serifStack, fontSize: "30px", lineHeight: 1.15, fontWeight: 500, color: COLOR_INK }}>
                        {guestName} wants to reserve {adventureTitle}.
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "16px 32px 8px", fontSize: "16px" }}>
                      <p style={{ margin: "0 0 8px" }}>Party: <strong>{party}</strong></p>
                      <p style={{ margin: 0, color: COLOR_MUTED, fontSize: "14px" }}>
                        This is a request (no payment taken). Confirm availability with the outfitter, then convert it in the admin roster.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "16px 32px 32px" }}>
                      <a href={reviewUrl} style={{ display: "inline-block", backgroundColor: COLOR_OLIVE, color: "#ffffff", textDecoration: "none", fontSize: "14px", fontWeight: 600, padding: "12px 22px", borderRadius: "4px" }}>
                        Review this request
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
