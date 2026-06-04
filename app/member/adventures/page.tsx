import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getMyAdventureHolds,
  getMyAdventureRsvps,
} from "@/src/services/members/adventures";
import { Eyebrow, Heading, PageShell } from "@/lib/ui";
import { MemberNav } from "@/src/components/members/member-nav";
import { AdventuresList } from "@/src/components/members/adventures-list";
import { MemberHoldCard } from "@/src/components/members/member-hold-card";

export const dynamic = "force-dynamic";

// /member/adventures — "my trips" (confirmed + waitlisted RSVPs), plus any
// in-progress checkout holds with a countdown to the release window so the
// member can finish (or knows it'll free up). Browsing + sign-up live on
// the public /adventures surface.
export default async function MyAdventuresPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: trips, error }, holds] = await Promise.all([
    getMyAdventureRsvps(supabase),
    getMyAdventureHolds(supabase),
  ]);

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        Member
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        Your <em>adventures</em>
      </Heading>
      <MemberNav active="adventures" />

      {holds.length > 0 && (
        <div className="flex flex-col gap-3 mb-6">
          {holds.map((hold) => (
            <MemberHoldCard
              key={hold.adventureId}
              adventureId={hold.adventureId}
              title={hold.title}
              holdExpiresAt={hold.holdExpiresAt}
            />
          ))}
        </div>
      )}

      <AdventuresList trips={trips ?? []} error={error} />
    </PageShell>
  );
}
