import { Button, Card } from "@/lib/ui";
import { copyToTestSiteNow } from "../actions";
import { DevSection } from "../_components/dev-section";
import s from "../dev.module.css";

// Runs the nightly live → test site copy now (see
// src/services/admin/test-site-sync.ts).
export function CopyToTestSiteSection() {
  return (
    <DevSection
      title="Copy live content to the test site"
      description={
        <>
          Runs the nightly copy now: clubs, pages, FAQ, services, pricing, adventures,
          instructors, waiver wording, templates and every event go to the preview database.
          Never members, bookings, bids, payments or logins, and nothing on the test site is
          deleted. Only works on the live site. Takes up to a minute.
        </>
      }
    >
      <Card padding="loose">
        <form action={copyToTestSiteNow} className={s.formStack}>
          <div className={s.actions}>
            <Button type="submit" variant="primary" size="sm">
              Copy to test site now
            </Button>
          </div>
        </form>
      </Card>
    </DevSection>
  );
}
