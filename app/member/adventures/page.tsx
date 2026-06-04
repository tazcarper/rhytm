import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyAdventureRsvps } from "@/src/services/members/adventures";
import { Eyebrow, Heading, PageShell } from "@/lib/ui";
import { MemberNav } from "@/src/components/members/member-nav";
import { AdventuresList } from "@/src/components/members/adventures-list";

export const dynamic = "force-dynamic";

// /member/adventures — "my trips". The adventures the member has reserved
// (confirmed or waitlisted). Read-only; browsing + sign-up live on the
// public /adventures surface. Thin orchestrator: fetch, render the list.
export default async function MyAdventuresPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await getMyAdventureRsvps(supabase);

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        Member
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        Your <em>adventures</em>
      </Heading>
      <MemberNav active="adventures" />
      <AdventuresList trips={data ?? []} error={error} />
    </PageShell>
  );
}
