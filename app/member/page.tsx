import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyMemberships } from "@/src/services/members/memberships";
import { getMyProfile } from "@/src/services/members/profile";
import { Alert, Eyebrow, Heading, PageShell } from "@/lib/ui";
import { MemberHeader } from "@/src/components/members/member-header";
import { MemberNav } from "@/src/components/members/member-nav";
import { MembershipCard } from "@/src/components/members/membership-card";

export const dynamic = "force-dynamic";

// Member portal. Orchestrates the data fetch and composition; the
// actual rendering of the identity strip, the membership cards, and
// the household sub-block lives in dedicated components under
// ./_components. The query + PostgREST-normalization lives in
// lib/services/memberships.ts. RLS scopes what the caller sees.
export default async function MemberHome() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships, error } = await getMyMemberships(
    supabase,
    user?.email ?? null,
  );

  const profile = user ? await getMyProfile(supabase, user.id) : null;

  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        Member
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        Welcome <em>back</em>
      </Heading>
      <MemberHeader
        email={user?.email}
        role={user?.app_metadata?.role as string | undefined}
        displayName={profile?.displayName ?? profile?.firstName ?? undefined}
      />

      <MemberNav active="home" />

      <div>
        <Eyebrow as="div" className="mb-2">
          Your memberships
        </Eyebrow>
        <Heading level={2} size="h3" underline>
          Where you belong
        </Heading>
      </div>

      {error && (
        <div className="mt-6">
          <Alert variant="error" title="Could not load memberships">
            {error.message}
          </Alert>
        </div>
      )}

      {memberships && memberships.length === 0 && (
        <p className="text-gray font-serif italic mt-6">
          No memberships are linked to this account yet.
        </p>
      )}

      {memberships && memberships.length > 0 && (
        <div className="flex flex-col gap-4 mt-6">
          {memberships.map((m) => (
            <MembershipCard key={m.id} membership={m} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
