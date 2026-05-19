import Link from "next/link";
import { Button, Card, Divider, Eyebrow, Heading, PageShell } from "@/lib/ui";

export const dynamic = "force-static";

export default function UnauthorizedPage() {
  return (
    <PageShell dark dotGrid>
      <Card
        elevation="lift"
        padding="loose"
        style={{ maxWidth: 480, width: "100%", textAlign: "center" }}
      >
        <Eyebrow variant="crest" as="div" style={{ marginBottom: "1.5rem" }}>
          Access Restricted
        </Eyebrow>
        <Heading level={1} size="h2" center>
          A different <em>portal</em>
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
          You&rsquo;re signed in, but this area is reserved for a different
          role.
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
          If you believe this is wrong, contact your Rhythm Outdoors
          administrator. Otherwise, head back to your own front gate.
        </p>
        <Button asChild variant="primary" fullWidth>
          <Link href="/">Return Home</Link>
        </Button>
      </Card>
    </PageShell>
  );
}
