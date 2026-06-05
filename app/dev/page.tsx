import { requireDevAuth } from "@/lib/dev/auth";
import { Eyebrow, Heading, PageShell } from "@/lib/ui";
import { DevBanners } from "./_components/dev-banners";
import { DevSidebar } from "./_components/dev-sidebar";
import { SECTIONS, DEV_NAV, DEFAULT_SECTION } from "./_sections/registry";
import s from "./dev.module.css";

export const dynamic = "force-dynamic";

// Thin orchestrator: auth-gate, surface action-result banners, then compose
// the sidebar + section panels from the registry. All section UI + data
// lives in app/dev/_sections/*; this file only wires them together.
export default async function DevDashboard({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; link?: string }>;
}) {
  await requireDevAuth();
  const { ok, error, link } = await searchParams;

  return (
    <PageShell width="wide">
      <header className={s.header}>
        <Eyebrow variant="crest" as="div">
          Internal Tool
        </Eyebrow>
        <Heading level={1} size="h1" underline center>
          Developer <em>Dashboard</em>
        </Heading>
        <p className={s.headerSubtitle}>
          Temporary scaffolding for testing against the live Supabase project. Removed before
          launch — the entire <code>/dev</code> tree.
        </p>
      </header>

      <DevBanners ok={ok} error={error} link={link} />

      <div className={s.shell}>
        <DevSidebar items={DEV_NAV} defaultId={DEFAULT_SECTION} />
        <div className={s.panels}>
          {SECTIONS.map(({ id, node }) => (
            <div key={id} data-dev-section={id} hidden={id !== DEFAULT_SECTION}>
              {node}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
