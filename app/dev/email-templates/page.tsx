import Link from "next/link";
import { render } from "@react-email/render";
import { requireDevAuth } from "@/lib/dev/auth";
import { Card, Eyebrow, Heading, PageShell } from "@/lib/ui";
import {
  TEMPLATE_GROUPS,
  TEMPLATE_PREVIEWS,
  findTemplatePreview,
  type TemplatePreview,
} from "./registry";
import s from "./email-templates.module.css";

// /dev/email-templates — dev-only template gallery (App 15).
//
// Sidebar of all 15 transactional email templates (grouped), with the selected
// one rendered with realistic sample data in an iframe. No email is sent and it
// works regardless of EMAIL_TRANSPORT — it renders the React components directly
// via @react-email/render (the same renderer production uses), so it fills the
// gap left by /dev/emails (which only lists the sent outbox and is bypassed
// under EMAIL_TRANSPORT=resend).
//
// Sample data lives in ./registry.tsx as real `<Component {...sample} />`
// elements, so npm run typecheck catches prop drift. No DB read at all — unlike
// /dev/emails, the gallery needs no service-role client.
//
// Drop with the rest of /dev pre-launch.

export const dynamic = "force-dynamic";

export default async function DevEmailTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  await requireDevAuth();

  const { t: requestedId } = await searchParams;
  const selected = findTemplatePreview(requestedId) ?? TEMPLATE_PREVIEWS[0];
  const html = await render(selected.element);

  return (
    <PageShell width="wide">
      <PageHeader />
      <ToolNav />

      <div className={s.layout}>
        <aside className={s.sidebar} aria-label="Email templates">
          {TEMPLATE_GROUPS.map((group) => {
            const groupPreviews = TEMPLATE_PREVIEWS.filter(
              (preview) => preview.group === group,
            );
            if (groupPreviews.length === 0) return null;
            return (
              <div key={group} className={s.sidebarGroup}>
                <div className={s.sidebarGroupLabel}>{group}</div>
                {groupPreviews.map((preview) => {
                  const isSelected = preview.id === selected.id;
                  return (
                    <Link
                      key={preview.id}
                      href={`/dev/email-templates?t=${preview.id}`}
                      className={`${s.sidebarLink} ${isSelected ? s.sidebarLinkActive : ""}`}
                      aria-current={isSelected ? "page" : undefined}
                    >
                      {preview.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </aside>

        <section className={s.detail}>
          <TemplateDetail preview={selected} html={html} />
        </section>
      </div>
    </PageShell>
  );
}

function PageHeader() {
  return (
    <header className={s.header}>
      <Eyebrow variant="crest" as="div">
        Internal Tool
      </Eyebrow>
      <Heading level={1} size="h1" underline center>
        Email <em>Templates</em>
      </Heading>
      <p className={s.headerSubtitle}>
        Every transactional template rendered with sample data — no send
        required, independent of <code>EMAIL_TRANSPORT</code>. Drop with the
        rest of <code>/dev</code> pre-launch.
      </p>
    </header>
  );
}

// Cross-link bar between the two dev email tools. The gallery (this page) is
// the active tab; the outbox is at /dev/emails.
function ToolNav() {
  return (
    <nav className={s.toolNav} aria-label="Email dev tools">
      <Link href="/dev/emails" className={s.toolNavLink}>
        Outbox — sent
      </Link>
      <span
        className={`${s.toolNavLink} ${s.toolNavLinkActive}`}
        aria-current="page"
      >
        Templates — gallery
      </span>
    </nav>
  );
}

function TemplateDetail({
  preview,
  html,
}: {
  preview: TemplatePreview;
  html: string;
}) {
  const propsJson = JSON.stringify(preview.element.props, null, 2);
  return (
    <>
      <Card padding="loose">
        <dl className={s.metaGrid}>
          <MetaRow label="Template" value={preview.label} />
          <MetaRow label="Group" value={preview.group} />
          {preview.variantNote && (
            <MetaRow label="State" value={preview.variantNote} />
          )}
          <MetaRow label="URL key" value={preview.id} mono />
        </dl>
      </Card>

      <Card padding="loose" className={s.previewCard}>
        <Eyebrow as="div">Rendered HTML</Eyebrow>
        <iframe
          className={s.iframe}
          srcDoc={html}
          sandbox=""
          title={`Email preview — ${preview.label}`}
        />
      </Card>

      <Card padding="loose">
        <Eyebrow as="div">Sample props</Eyebrow>
        <pre className={s.pre}>{propsJson}</pre>
      </Card>
    </>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <>
      <dt className={s.metaLabel}>{label}</dt>
      <dd className={mono ? `${s.metaValue} ${s.mono}` : s.metaValue}>
        {value}
      </dd>
    </>
  );
}
