import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  Divider,
  Eyebrow,
  Heading,
  PageShell,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<string, string> = {
  missing_token: "No token in URL",
  exchange_code: "Code exchange failed (PKCE)",
  verify_otp: "Token verification failed",
  get_user: "Session not established after sign-in",
  pending_query: "Lookup of pending members rows failed",
  link_rows: "Linking members rows to auth user failed",
  stamp_role: "Stamping app_metadata.role failed",
  refresh_jwt: "JWT refresh after role stamp failed",
};

export default async function AuthCodeErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; reason?: string }>;
}) {
  const { stage, reason } = await searchParams;
  const label = stage ? (STAGE_LABELS[stage] ?? stage) : null;

  return (
    <PageShell dark dotGrid>
      <Card
        elevation="lift"
        padding="loose"
        style={{ maxWidth: 480, width: "100%", textAlign: "center" }}
      >
        <Eyebrow variant="crest" as="div" style={{ marginBottom: "1.5rem" }}>
          Link Expired
        </Eyebrow>
        <Heading level={1} size="h2" center>
          That link <em>didn&rsquo;t work</em>
        </Heading>
        <p
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 17,
            color: "var(--gray)",
            margin: "1rem 0 0",
            lineHeight: 1.5,
          }}
        >
          Magic links are single-use and expire after a short period.
        </p>
        <Divider variant="accent" />
        <p
          style={{
            fontSize: 14,
            color: "var(--olive)",
            lineHeight: 1.6,
            marginBottom: "1.5rem",
          }}
        >
          If you recently clicked an older email, request a fresh sign-in
          link and try again.
        </p>

        {(label || reason) && (
          <div style={{ textAlign: "left", marginBottom: "1.5rem" }}>
            <Alert variant="error" title="Technical detail">
              {label && (
                <p style={{ margin: 0 }}>
                  <strong>Stage:</strong> {label}
                </p>
              )}
              {reason && (
                <p style={{ margin: "0.25rem 0 0" }}>
                  <strong>Reason:</strong>{" "}
                  <code style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                    {reason}
                  </code>
                </p>
              )}
            </Alert>
          </div>
        )}

        <Button asChild variant="primary" fullWidth>
          <Link href="/login">Back to sign-in</Link>
        </Button>
      </Card>
    </PageShell>
  );
}
