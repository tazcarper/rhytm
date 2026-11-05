import { Alert } from "@/lib/ui";
import { InProgressIndicator } from "./in-progress-indicator";
import { Spotlight } from "./spotlight";
import type { EventFeatureRequest } from "@/src/services/ai/capability-requests";

// Top of a draft's page when the AI helper couldn't build part of it: says
// the rest is saved and which part is being built, or that it's now ready.
// With spotlight (the helper just saved this draft), the "in progress" note
// is highlighted with the rest of the page dimmed until it's dismissed.
export function EventFeatureRequestNotice({
  requests,
  spotlight = false,
}: {
  requests: ReadonlyArray<EventFeatureRequest>;
  spotlight?: boolean;
}) {
  const waiting = requests.filter((request) => request.state === "waiting");
  const ready = requests.filter((request) => request.state === "ready");

  return (
    <>
      {waiting.length > 0 && (
        <Spotlight active={spotlight} clearParam="saved">
          <Alert
            variant="warn"
            title={
              <span className="inline-flex items-center gap-2">
                <InProgressIndicator />
                Feature in progress
              </span>
            }
          >
            <p className="m-0">
              The rest of this draft is saved. The part below isn&apos;t in the
              event builder yet, so it&apos;s been sent to the developer to
              build:
            </p>
            <ul className="my-2 list-disc pl-5">
              {waiting.map((request) => (
                <li key={request.requestId}>{request.summary}</li>
              ))}
            </ul>
            <p className="m-0">
              You can keep editing, but it can&apos;t be published until this is
              built. You&apos;ll see it marked ready here when it&apos;s done.
            </p>
          </Alert>
        </Spotlight>
      )}
      {ready.length > 0 && (
        <Alert variant="success" title="A feature you asked for is ready">
          <ul className="my-1 list-disc pl-5">
            {ready.map((request) => (
              <li key={request.requestId}>{request.summary}</li>
            ))}
          </ul>
          <p className="m-0">
            It&apos;s now in the builder below. Add it to this event, then
            publish.
          </p>
        </Alert>
      )}
    </>
  );
}
