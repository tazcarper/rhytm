import { Alert } from "@/lib/ui";
import s from "../dev.module.css";

// Action-result banners, driven by the ?ok / ?error / ?link search params
// that the server actions redirect back with. Always shown above the active
// section so feedback is visible regardless of which section you're on.
export function DevBanners({
  ok,
  error,
  link,
}: {
  ok?: string;
  error?: string;
  link?: string;
}) {
  if (!ok && !error && !link) return null;
  return (
    <div className="flex flex-col gap-3 mb-6">
      {ok && (
        <Alert variant="success" title="Done">
          {ok}
        </Alert>
      )}
      {error && (
        <Alert variant="error" title="Action failed">
          {error}
        </Alert>
      )}
      {link && (
        <Alert variant="info" title="Magic link generated">
          <p>
            Single-use. Opens the sign-in flow when clicked. Use the same browser you&rsquo;re
            testing in.
          </p>
          <p>
            <a className={s.linkOut} href={link}>
              {link}
            </a>
          </p>
        </Alert>
      )}
    </div>
  );
}
