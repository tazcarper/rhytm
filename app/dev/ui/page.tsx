import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Eyebrow,
  FormField,
  Heading,
  Input,
  PageShell,
  Textarea,
} from "@/lib/ui";
import styles from "./showcase.module.css";

export const dynamic = "force-static";

// Visual review surface. Renders every primitive in every variant so
// the system can be eyeballed in a single scroll. NOT auth-gated —
// it's safe to leave behind because it's just a static composition of
// our own components, no PII, no DB. Remove on launch if desired.
export default function UIShowcase() {
  return (
    <PageShell width="wide">
      <header className={styles.header}>
        <Eyebrow variant="crest" as="div">
          Design System
        </Eyebrow>
        <Heading level={1} size="h1" underline center>
          Primitives <em>at a glance</em>
        </Heading>
        <p className={styles.subtitle}>
          Every component in <code>@/lib/ui</code>, rendered in every
          variant. Use this page to review visual consistency, catch
          regressions when tokens change, and brief designers on what is
          already available.
        </p>
      </header>

      <Section eyebrow="01" title="Buttons">
        <div className={styles.row}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>

        <Subhead>Sizes</Subhead>
        <div className={styles.row}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>

        <Subhead>States</Subhead>
        <div className={styles.row}>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button leading={<Dot />}>With leading</Button>
        </div>

        <Subhead>Full width</Subhead>
        <Button fullWidth variant="primary">
          Enter
        </Button>
      </Section>

      <Section eyebrow="02" title="Form fields">
        <Card padding="loose" elevation="flat" warm>
          <FormField label="Email" helper="We'll never share it.">
            {(p) => <Input {...p} type="email" placeholder="you@example.com" />}
          </FormField>

          <FormField label="Member number" required>
            {(p) => <Input {...p} placeholder="HSB-####" />}
          </FormField>

          <FormField
            label="Anything else"
            helper="Sponsor opportunities, dietary needs, anything we should know."
          >
            {(p) => <Textarea {...p} rows={4} />}
          </FormField>

          <FormField
            label="Invalid example"
            error="That doesn't look like a valid email."
          >
            {(p) => <Input {...p} type="email" defaultValue="not-an-email" />}
          </FormField>
        </Card>
      </Section>

      <Section eyebrow="03" title="Typography">
        <Heading level={1} size="display">
          Display headline <em>with emphasis</em>
        </Heading>
        <Heading level={1}>
          Heading 1 <em>italic accent</em>
        </Heading>
        <Heading level={2} underline>
          Heading 2 with rule
        </Heading>
        <Heading level={3}>Heading 3</Heading>
        <Heading level={4}>Heading 4</Heading>
        <Divider />
        <Eyebrow>Default eyebrow</Eyebrow>
        <Eyebrow variant="muted">Muted eyebrow</Eyebrow>
        <Eyebrow variant="crest" as="div">
          Crest eyebrow
        </Eyebrow>
      </Section>

      <Section eyebrow="04" title="Cards">
        <div className={styles.cardGrid}>
          <Card>
            <Eyebrow as="div">Soft</Eyebrow>
            <Heading level={3}>Default card</Heading>
            <p>The default surface — paper background, soft shadow.</p>
          </Card>
          <Card warm>
            <Eyebrow as="div">Warm</Eyebrow>
            <Heading level={3}>Warm paper</Heading>
            <p>Switches to the cream-warm paper background.</p>
          </Card>
          <Card elevation="lift" hoverable>
            <Eyebrow as="div">Lifted</Eyebrow>
            <Heading level={3}>Hoverable</Heading>
            <p>Heavier shadow, lifts on hover. Try it.</p>
          </Card>
          <Card elevation="flat">
            <Eyebrow as="div">Flat</Eyebrow>
            <Heading level={3}>No shadow</Heading>
            <p>For nested or list contexts where elevation would crowd.</p>
          </Card>
        </div>
      </Section>

      <Section eyebrow="05" title="Alerts">
        <Alert variant="info" title="Heads up">
          An informational message. Wraps long copy as needed.
        </Alert>
        <Alert variant="success" title="All set">
          Your invitation has been sent.
        </Alert>
        <Alert variant="warn" title="Take care">
          Something looks unusual, but not broken.
        </Alert>
        <Alert variant="error" title="We hit a snag">
          We searched for <strong>guest@example.com</strong> but found no
          pending invitation, or your invitation has expired.
        </Alert>
      </Section>

      <Section eyebrow="06" title="Badges">
        <Subhead>Status</Subhead>
        <div className={styles.row}>
          <Badge variant="open">Open</Badge>
          <Badge variant="filling">Filling</Badge>
          <Badge variant="waitlist">Waitlist</Badge>
          <Badge variant="full">Full</Badge>
          <Badge variant="past">Past</Badge>
          <Badge variant="draft">Draft</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </div>

        <Subhead>Membership tiers</Subhead>
        <div className={styles.row}>
          <Badge pill variant="tierFounder">
            Founder
          </Badge>
          <Badge pill variant="tierCharter">
            Charter
          </Badge>
          <Badge pill variant="tierMember">
            Member
          </Badge>
          <Badge pill variant="tierLegacy">
            Legacy
          </Badge>
        </div>
      </Section>

      <Section eyebrow="07" title="Dividers">
        <Divider />
        <Divider variant="accent" />
        <Divider variant="accent" thick />
      </Section>

      <Section eyebrow="08" title="Page shell — dark variant">
        <div className={styles.darkPreview}>
          <PageShell dark dotGrid as="div">
            <Card elevation="lift" padding="loose" className={styles.modalCard}>
              <Eyebrow variant="crest" as="div">
                Outside the portal
              </Eyebrow>
              <Heading level={2} size="h2" center>
                Login, 404, <em>callbacks</em>
              </Heading>
              <p style={{ marginTop: "1rem" }}>
                Full-bleed olive with a centered ivory card. Same wrapper
                across every "unauthenticated" surface.
              </p>
            </Card>
          </PageShell>
        </div>
      </Section>
    </PageShell>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <Eyebrow as="div">{eyebrow}</Eyebrow>
        <Heading level={2} size="h2" underline>
          {title}
        </Heading>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return <Eyebrow as="div" className="subhead-spacer">{children}</Eyebrow>;
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "currentColor",
        display: "inline-block",
      }}
    />
  );
}
