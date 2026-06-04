import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Eyebrow, Heading, PageShell } from "@/lib/ui";
import { AdventureEditorForm } from "@/src/components/admin/adventure-editor-form";

export const dynamic = "force-dynamic";

export default async function NewAdventurePage() {
  const supabase = await createServerSupabaseClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, name")
    .order("name");

  return (
    <PageShell width="narrow">
      <Link
        href="/admin/adventures"
        className="inline-block font-sans text-[12px] tracking-[1px] uppercase text-tan-deep no-underline mb-4 hover:text-olive"
      >
        &larr; All adventures
      </Link>
      <Eyebrow as="div" className="mb-2">Admin &middot; Adventures</Eyebrow>
      <Heading level={1} size="h2">New adventure</Heading>
      <div className="mt-6">
        <AdventureEditorForm properties={properties ?? []} />
      </div>
    </PageShell>
  );
}
