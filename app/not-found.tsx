import Link from "next/link";
import {
  Button,
  Card,
  Divider,
  Eyebrow,
  Heading,
  PageShell,
} from "@/lib/ui";
import styles from "./not-found.module.css";

// Next.js renders this whenever a route is missing or a Server
// Component calls notFound(). Editorial / "off the path" treatment to
// match the rest of the brand — full-bleed olive, ivory card, serif
// headline with italic emphasis, single primary action back to the
// front gate. Auth-agnostic: never queries Supabase, safe to render
// statically.
export const dynamic = "force-static";

export default function NotFound() {
  return (
    <PageShell dark dotGrid>
      <Card
        elevation="lift"
        padding="loose"
        className={styles.card}
      >
        <Eyebrow variant="crest" as="div" className={styles.crest}>
          Off the Path
        </Eyebrow>
        <Heading level={1} size="h1" center className={styles.headline}>
          Nothing <em>here.</em>
        </Heading>
        <p className={styles.deck}>
          Either you followed an old link, or the page you&rsquo;re
          looking for has wandered into the brush.
        </p>
        <Divider variant="accent" className={styles.divider} />
        <p className={styles.body}>
          Head back to the front gate &mdash; we&rsquo;ll get you where
          you&rsquo;re going.
        </p>
        <div className={styles.actions}>
          <Button asChild variant="primary" fullWidth>
            <Link href="/">Return Home</Link>
          </Button>
        </div>
        <div className={styles.foot}>
          Still lost? Reach the concierge at{" "}
          <a href="mailto:concierge@rhythmoutdoors.com">
            concierge@rhythmoutdoors.com
          </a>
          .
        </div>
      </Card>
    </PageShell>
  );
}
