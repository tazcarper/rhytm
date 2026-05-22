import Link from "next/link";
import { requireDevAuth } from "@/lib/dev/auth";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  Alert,
  Badge,
  Card,
  Eyebrow,
  Heading,
  PageShell,
} from "@/lib/ui";
import s from "./emails.module.css";

// /dev/emails — dev-only visual review surface for the App 2.9 email shim.
// Lists rows from dev_email_outbox (most recent first), renders the
// selected row's body_html inside an iframe via srcDoc. Auth gate is the
// shared DEV_DASHBOARD_PASSWORD cookie — same as the rest of /dev.
//
// Drop with the rest of /dev pre-launch.

export const dynamic = "force-dynamic";

// Two row shapes — the list view doesn't need the (potentially many-KB)
// `body_html` payload. We fetch metadata for all rows, and `body_html`
// only for the selected one.
interface OutboxListRow {
  id: string;
  source: string;
  template_name: string;
  to_email: string;
  from_email: string;
  subject: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface OutboxFullRow extends OutboxListRow {
  body_html: string;
}

export default async function DevEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireDevAuth();

  const { id: requestedId } = await searchParams;
  const admin = createServiceRoleClient();

  // List query first — small payload. The selected row's body_html is
  // fetched in a second query (parallel with this one would race the
  // requestedId resolution, so it's sequential by necessity).
  const { data: listData, error: listError } = await admin
    .from("dev_email_outbox")
    .select(
      "id, source, template_name, to_email, from_email, subject, payload, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (listError) {
    return (
      <PageShell width="wide">
        <PageHeader />
        <Alert variant="error" title="Couldn't load outbox">
          {listError.message}
        </Alert>
      </PageShell>
    );
  }

  const rows = (listData ?? []) as OutboxListRow[];
  const selectedSummary =
    rows.find((r) => r.id === requestedId) ?? rows[0] ?? null;

  let selected: OutboxFullRow | null = null;
  if (selectedSummary) {
    const { data: bodyData, error: bodyError } = await admin
      .from("dev_email_outbox")
      .select("body_html")
      .eq("id", selectedSummary.id)
      .single();
    if (!bodyError && bodyData) {
      selected = { ...selectedSummary, body_html: bodyData.body_html };
    }
  }

  return (
    <PageShell width="wide">
      <PageHeader />

      {rows.length === 0 ? (
        <Card padding="loose">
          <p>
            No emails in the outbox yet. Walk the public booking funnel
            end-to-end and submit one — this list updates on the next
            page load.
          </p>
        </Card>
      ) : (
        <div className={s.layout}>
          <aside className={s.list} aria-label="Outbox">
            {rows.map((row) => {
              const isSelected = selected?.id === row.id;
              return (
                <Link
                  key={row.id}
                  href={`/dev/emails?id=${row.id}`}
                  className={`${s.listItem} ${isSelected ? s.listItemActive : ""}`}
                  aria-current={isSelected ? "true" : undefined}
                >
                  <div className={s.listItemRow}>
                    <span className={s.listSubject}>{row.subject}</span>
                    <Badge variant="open">{row.template_name}</Badge>
                  </div>
                  <div className={s.listItemRow}>
                    <span className={s.listMeta}>{row.to_email}</span>
                    <span className={s.listMeta}>{fmtRelative(row.created_at)}</span>
                  </div>
                </Link>
              );
            })}
          </aside>

          <section className={s.detail}>
            {selected && <EmailDetail row={selected} />}
          </section>
        </div>
      )}
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
        Email <em>Outbox</em>
      </Heading>
      <p className={s.headerSubtitle}>
        Rendered emails written by the App 2.9 confirmation shim. Drop with
        the rest of <code>/dev</code> pre-launch.
      </p>
    </header>
  );
}

function EmailDetail({ row }: { row: OutboxFullRow }) {
  const payloadJson = JSON.stringify(row.payload ?? {}, null, 2);
  return (
    <>
      <Card padding="loose">
        <dl className={s.metaGrid}>
          <MetaRow label="Subject" value={row.subject} />
          <MetaRow label="To" value={row.to_email} />
          <MetaRow label="From" value={row.from_email} />
          <MetaRow label="Template" value={row.template_name} mono />
          <MetaRow label="Source" value={row.source} mono />
          <MetaRow label="Sent" value={fmtAbsolute(row.created_at)} mono />
        </dl>
      </Card>

      <Card padding="loose" className={s.previewCard}>
        <Eyebrow as="div">Rendered HTML</Eyebrow>
        <iframe
          className={s.iframe}
          srcDoc={row.body_html}
          sandbox=""
          title={`Email preview — ${row.subject}`}
        />
      </Card>

      <Card padding="loose">
        <Eyebrow as="div">Template props</Eyebrow>
        <pre className={s.pre}>{payloadJson}</pre>
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

function fmtAbsolute(iso: string): string {
  try {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return iso;
  }
}

// Minimal relative formatter — keeps the list scannable without
// pulling a date lib. "just now / Nm / Nh / Nd / YYYY-MM-DD".
function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 30) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return iso.slice(0, 10);
}
