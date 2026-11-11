// Owner heads-up — a feature build that touches payments, emails,
// bookings, member records or the database's automatic rules was just
// published by staff (Taz, 2026-11-10). Internal, functional, not
// guest-branded. Prop shape is the contract with
// src/services/ai/build-risk-notice.ts.

export interface BuildPublishedNoticeProps {
  summary: string;
  publishedBy: string;
  reasons: ReadonlyArray<string>;
  pullRequestUrl: string | null;
  requestsUrl: string;
}

const COLOR_INK = "#1a1a1a";
const COLOR_MUTED = "#5a5a5a";
const COLOR_PAPER = "#faf7f1";
const COLOR_BORDER = "#e5dfd2";

const fontStack =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function BuildPublishedNotice({ summary, publishedBy, reasons, pullRequestUrl, requestsUrl }: BuildPublishedNoticeProps) {
  return (
    <div style={{ margin: 0, padding: "24px", background: COLOR_PAPER, fontFamily: fontStack, color: COLOR_INK }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#ffffff", border: `1px solid ${COLOR_BORDER}`, padding: "24px" }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>A feature that needs care just went live</p>
        <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.5 }}>
          {publishedBy} published <strong>{summary}</strong> to the real site.
        </p>
        <p style={{ margin: "16px 0 4px", fontSize: 15 }}>It was flagged because it:</p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15, lineHeight: 1.5 }}>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.5 }}>
          <a href={requestsUrl} style={{ color: COLOR_INK }}>
            See feature requests
          </a>
          {pullRequestUrl && (
            <>
              {" · "}
              <a href={pullRequestUrl} style={{ color: COLOR_INK }}>
                See the code change
              </a>
            </>
          )}
        </p>
        <p style={{ margin: "16px 0 0", fontSize: 13, color: COLOR_MUTED }}>
          Nothing to do unless something looks wrong. Only changes that can&apos;t be undone wait for you to publish them.
        </p>
      </div>
    </div>
  );
}
