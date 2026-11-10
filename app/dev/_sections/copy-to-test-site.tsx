import { Card } from "@/lib/ui";
import { CopyToTestSiteButton } from "./copy-to-test-site-button";
import { DevSection } from "../_components/dev-section";

// Runs the nightly live → test site copy now (see
// src/services/admin/test-site-sync.ts).
export function CopyToTestSiteSection() {
  return (
    <DevSection
      title="Copy live content to the test site"
      description={
        <>
          Runs the nightly copy now: clubs, pages, FAQ, services, pricing,
          adventures, instructors, waiver wording, templates and every event go
          to the preview database. Never members, bookings, bids, payments or
          logins, and nothing on the test site is deleted. Only works on the
          live site. Takes up to a minute.
        </>
      }
    >
      <Card padding="loose">
        <CopyToTestSiteButton />
      </Card>
    </DevSection>
  );
}
