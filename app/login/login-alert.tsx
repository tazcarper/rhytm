"use client";

import { useRouter } from "next/navigation";
import { Alert } from "@/lib/ui";

// Errors that the /auth/callback (or any other sender) can surface
// back to /login via `?error=<key>&email=<addr>`. New types just need
// a row in this map.
const MESSAGES: Record<
  string,
  { title: string; body: (email: string | null) => React.ReactNode }
> = {
  "invite-not-found": {
    title: "We couldn’t find an invitation",
    body: (email) =>
      email ? (
        <>
          We searched for <strong>{email}</strong> but found no pending
          invitation, or your invitation has expired. Contact your
          property’s membership coordinator to be invited.
        </>
      ) : (
        <>
          No pending invitation was found for that email. Contact your
          property’s membership coordinator to be invited.
        </>
      ),
  },
};

export function LoginAlert({
  errorKey,
  email,
}: {
  errorKey: string;
  email: string | null;
}) {
  const router = useRouter();
  const message = MESSAGES[errorKey];
  if (!message) return null;

  return (
    <Alert
      variant="error"
      title={message.title}
      onDismiss={() => {
        // Drop ?error and ?email from the URL so the alert doesn't
        // reappear on refresh. router.replace avoids a history entry.
        router.replace("/login");
      }}
    >
      <p>{message.body(email)}</p>
    </Alert>
  );
}
