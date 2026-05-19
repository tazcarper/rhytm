import Link from "next/link";
import { Button, Card, Divider, Eyebrow, Heading, PageShell } from "@/lib/ui";

export const dynamic = "force-static";

export default function UnauthorizedPage() {
  return (
    <PageShell dark dotGrid>
      <Card
        elevation="lift"
        padding="loose"
        className="max-w-[480px] w-full text-center"
      >
        <Eyebrow variant="crest" as="div" className="mb-6">
          Access Restricted
        </Eyebrow>
        <Heading level={1} size="h2" center>
          A different <em>portal</em>
        </Heading>
        <p className="font-serif italic text-body-lg text-gray mt-4 mb-0 leading-[1.5]">
          You&rsquo;re signed in, but this area is reserved for a different
          role.
        </p>
        <Divider variant="accent" />
        <p className="text-[14px] text-olive leading-body mb-6">
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
