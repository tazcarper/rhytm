import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button, Card, Eyebrow } from "@/lib/ui";
import { logoutDev, signOutUser } from "../actions";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

// Shows the current Supabase session + its app_metadata claims.
export async function SessionSection() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <DevSection title="Current session">
      <Card padding="loose">
        {user ? (
          <div className={s.sessionRow}>
            <p className="m-0">
              Signed in as <strong>{user.email}</strong> <code>({user.id})</code>
            </p>
            <Eyebrow as="div">app_metadata</Eyebrow>
            <pre className={s.pre}>{JSON.stringify(user.app_metadata, null, 2)}</pre>
            <div className={s.actions}>
              <form action={signOutUser}>
                <Button variant="secondary" size="sm" type="submit">
                  Sign out of Supabase
                </Button>
              </form>
              <form action={logoutDev}>
                <Button variant="ghost" size="sm" type="submit">
                  Exit dev dashboard
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className={s.sessionRow}>
            <p className="m-0 text-gray">No Supabase session. Generate a link below to sign in.</p>
            <div className={s.actions}>
              <form action={logoutDev}>
                <Button variant="ghost" size="sm" type="submit">
                  Exit dev dashboard
                </Button>
              </form>
            </div>
          </div>
        )}
      </Card>
    </DevSection>
  );
}
