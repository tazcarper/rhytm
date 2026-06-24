import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Alert, Heading, PageShell, Text } from "@/lib/ui";
import { AdminBreadcrumb } from "@/src/components/admin/admin-breadcrumb";
import { getHomepageHero, type HomepageHero } from "@/src/services/public/homepage-hero";
import { HomepageHeroForm } from "@/src/components/admin/homepage-hero-form";

export const dynamic = "force-dynamic";

export default async function AdminHomepagePage() {
  const supabase = await createServerSupabaseClient();

  let hero: HomepageHero | null = null;
  let loadError: string | null = null;
  try {
    hero = await getHomepageHero(supabase);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load the hero";
  }

  return (
    <PageShell width="wide">
      <AdminBreadcrumb
        segments={[{ label: "Admin", href: "/admin" }, { label: "Homepage" }]}
      />
      <Heading level={1} size="h2" underline>
        Homepage Hero
      </Heading>
      <Text variant="lead">
        Edit the banner at the top of the public homepage — the eyebrow,
        headline, supporting text, the two buttons, and an optional
        background image. Changes apply immediately.
      </Text>

      {loadError && (
        <Alert variant="error" title="Could not load the hero">
          {loadError}
        </Alert>
      )}

      {hero && <HomepageHeroForm hero={hero} />}
    </PageShell>
  );
}
