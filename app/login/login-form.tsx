"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { portalHomeForRole } from "@/lib/auth/portal";
import { Button, FormField, Input } from "@/lib/ui";
import styles from "./login.module.css";

// idle                — nothing in flight, form is interactive
// submitting_email     — magic-link OTP request awaiting Supabase response
// submitting_password  — password sign-in awaiting Supabase response
// sent                 — Supabase accepted the OTP request, "check your inbox"
// submitting_google    — OAuth redirect to Google has been initiated; the
//                        browser is about to leave this page. State exists
//                        so the buttons disable for the (brief) gap
//                        between click and navigation.
// error                — last action failed, errorMessage is populated
type FormState =
  | "idle"
  | "submitting_email"
  | "submitting_password"
  | "sent"
  | "submitting_google"
  | "error";

export function LoginForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function buildCallbackUrl(): string {
    const callback = new URL("/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);
    return callback.toString();
  }

  // One smart submit: if the member typed a password, sign in with it;
  // otherwise fall back to the magic-link flow. Passwords are an opt-in
  // convenience members can set in their profile after first login — the
  // link path stays the default and works for everyone.
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    if (password) {
      await handlePasswordSignIn();
    } else {
      await handleMagicLink();
    }
  }

  async function handlePasswordSignIn() {
    setState("submitting_password");
    setErrorMessage(null);

    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(mapErrorMessage(error.message));
      setState("error");
      return;
    }

    // Password sign-in doesn't pass through /auth/callback, but the role
    // claim is already on the user from their first (magic-link) login, so
    // the JWT gates middleware correctly. Send them to `next` or their
    // role's portal home.
    const role = data.user?.app_metadata?.role as string | undefined;
    window.location.assign(next ?? portalHomeForRole(role));
  }

  async function handleMagicLink() {
    setState("submitting_email");
    setErrorMessage(null);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: buildCallbackUrl(),
        // Members are pre-seeded via the Excel roster — `inviteUserByEmail`
        // creates the auth user at invite time. A returning member's
        // auth.users row therefore exists by the time they hit /login.
        // shouldCreateUser:false means an unknown email refuses to send
        // a link rather than minting an orphan auth user; the caller
        // gets a friendly "no account" message via mapErrorMessage.
        shouldCreateUser: false,
      },
    });

    if (error) {
      setErrorMessage(mapErrorMessage(error.message));
      setState("error");
      return;
    }

    setState("sent");
  }

  async function handleGoogleSignIn() {
    setState("submitting_google");
    setErrorMessage(null);

    const supabase = createBrowserSupabaseClient();
    // signInWithOAuth navigates the browser by default. On success, this
    // call does not resolve here — the page is replaced by Google's
    // consent screen. On error (provider disabled, network), it returns
    // synchronously and we surface the message.
    //
    // Unlike signInWithOtp there is no shouldCreateUser flag for OAuth.
    // A non-invited Google account will create an orphan auth.users row;
    // /auth/callback handles it by signing them back out and redirecting
    // to /login?error=invite-not-found, which surfaces as an inline
    // alert at the top of this card.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildCallbackUrl(),
      },
    });

    if (error) {
      setErrorMessage(mapErrorMessage(error.message));
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className={styles.loginSent}>
        <p>
          We sent a sign-in link to <strong>{email}</strong>. It will be
          valid for the next several days.
        </p>
        <button
          type="button"
          className={styles.loginReset}
          onClick={() => {
            setEmail("");
            setPassword("");
            setState("idle");
            setErrorMessage(null);
          }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  const isBusy =
    state === "submitting_email" ||
    state === "submitting_password" ||
    state === "submitting_google";

  const submitLabel =
    state === "submitting_password"
      ? "Signing in"
      : state === "submitting_email"
        ? "Sending link"
        : password
          ? "Sign in"
          : "Email me a sign-in link";

  return (
    <>
      <form
        className={`${styles.loginForm} ${state === "error" ? styles.shake : ""}`}
        onSubmit={handleSubmit}
        autoComplete="on"
        // Reset the shake animation each time the user resubmits.
        key={state === "error" ? "error" : "ok"}
      >
        <FormField label="Email">
          {(controlProps) => (
            <Input
              {...controlProps}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              disabled={isBusy}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="Password"
          helper="Leave blank and we'll email you a sign-in link. Set a password in your profile to skip the email next time."
        >
          {(controlProps) => (
            <Input
              {...controlProps}
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={isBusy}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </FormField>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={state === "submitting_email" || state === "submitting_password"}
          disabled={isBusy || !email}
        >
          {submitLabel}
        </Button>
      </form>

      <div className={styles.loginOr} aria-hidden="true">
        <span>or</span>
      </div>

      <Button
        type="button"
        variant="secondary"
        fullWidth
        leading={<GoogleMark />}
        onClick={handleGoogleSignIn}
        loading={state === "submitting_google"}
        disabled={isBusy}
      >
        {state === "submitting_google" ? "Redirecting" : "Continue with Google"}
      </Button>

      <div className={styles.loginError} role="alert" aria-live="polite">
        {errorMessage ?? ""}
      </div>
    </>
  );
}

// Google's official 4-color G mark. Decorative — the button text
// already says "Continue with Google", so the SVG is aria-hidden.
function GoogleMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

// Map Supabase's raw error strings to copy that matches the rest of
// the page. Anything unmapped falls through as the original message so
// we don't accidentally swallow useful information.
function mapErrorMessage(supabaseErrorMessage: string): string {
  const lower = supabaseErrorMessage.toLowerCase();
  // Password sign-in with a wrong/unset password. Generic on purpose — don't
  // reveal whether the email exists or whether a password is set — and point
  // them at the always-available magic link.
  if (lower.includes("invalid login credentials")) {
    return "That email and password didn’t match. Leave the password blank to get a sign-in link instead.";
  }
  if (
    lower.includes("user not found") ||
    lower.includes("signups not allowed") ||
    lower.includes("not allowed")
  ) {
    return "We don’t see an account for that email. Reach your property’s membership coordinator to be invited.";
  }
  if (
    lower.includes("provider is not enabled") ||
    lower.includes("unsupported provider") ||
    lower.includes("validation_failed")
  ) {
    return "Google sign-in isn’t enabled yet. Please use your email instead.";
  }
  if (lower.includes("rate") || lower.includes("too many")) {
    return "Too many requests just now. Please wait a minute and try again.";
  }
  if (lower.includes("invalid") && lower.includes("email")) {
    return "That email address doesn’t look right.";
  }
  return `Sign-in failed: ${supabaseErrorMessage}`;
}
