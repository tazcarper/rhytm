import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  Divider,
  Eyebrow,
  Heading,
  PageShell,
  Text,
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
        className="max-w-[480px] w-full text-center"
      >
        <Eyebrow variant="crest" as="div" className="mb-6">
          Link Expired
        </Eyebrow>
        <Heading level={1} size="h2" center>
          That link <em>didn&rsquo;t work</em>
        </Heading>
        <Text variant="lead" className="mt-4 mb-0">
          Magic links are single-use and expire after a short period.
        </Text>
        <Divider variant="accent" />
        <Text className="mb-6">
          If you recently clicked an older email, request a fresh sign-in
          link and try again.
        </Text>

        {(label || reason) && (
          <div className="text-left mb-6">
            <Alert variant="error" title="Technical detail">
              {label && (
                <p className="m-0">
                  <strong>Stage:</strong> {label}
                </p>
              )}
              {reason && (
                <p className="mt-1 mb-0">
                  <strong>Reason:</strong>{" "}
                  <code className="font-mono">{reason}</code>
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
