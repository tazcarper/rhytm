import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getAdminAdventure,
  getAdventureRoster,
} from "@/src/services/admin/adventures";
import { Eyebrow, Heading, PageShell } from "@/lib/ui";
import { AdventureEditorForm } from "@/src/components/admin/adventure-editor-form";
import { AdventureRoster } from "@/src/components/admin/adventure-roster";

export const dynamic = "force-dynamic";

export default async function AdminAdventureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [adventure, propertiesRes, roster] = await Promise.all([
    getAdminAdventure(supabase, id),
    supabase.from("properties").select("id, name").order("name"),
    getAdventureRoster(supabase, id),
  ]);
  if (!adventure) notFound();

  return (
    <PageShell width="wide">
      <Link
        href="/admin/adventures"
        className="inline-block font-sans text-[12px] tracking-[1px] uppercase text-tan-deep no-underline mb-4 hover:text-olive"
      >
        &larr; All adventures
      </Link>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Eyebrow as="div" className="mb-2">Admin &middot; Adventures</Eyebrow>
          <Heading level={1} size="h2">{adventure.title}</Heading>
        </div>
        <a
          href={`/adventures/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-sans text-[12px] tracking-[0.5px] uppercase text-tan-deep no-underline hover:text-olive"
        >
          View public page &#8599;
        </a>
      </div>

      <section className="mt-6 mb-10">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Heading level={2} size="h3">Roster</Heading>
          <Link
            href={`/admin/adventures/${id}/roster.csv`}
            className="font-sans text-[12px] tracking-[0.5px] uppercase text-tan-deep no-underline hover:text-olive"
          >
            Export CSV &darr;
          </Link>
        </div>
        <AdventureRoster adventureId={id} rows={roster} />
      </section>

      <Heading level={2} size="h3" className="mb-3">Edit</Heading>
      <AdventureEditorForm properties={propertiesRes.data ?? []} initial={adventure} />
    </PageShell>
  );
}
