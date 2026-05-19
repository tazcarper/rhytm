import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "node:crypto";

// Password gate for the temporary /dev test dashboard. Compares
// SHA-256(provided password) against SHA-256(DEV_DASHBOARD_PASSWORD)
// with a constant-time compare, then sets the hash as the cookie value.
// If DEV_DASHBOARD_PASSWORD changes, every previously-issued cookie
// invalidates automatically because the expected hash no longer matches.
//
// This is sufficient for a developer-only tool; it is not a substitute
// for real auth. The /dev tree should be removed before production
// launch.

const COOKIE_NAME = "dev-dashboard-auth";
const COOKIE_PATH = "/dev";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

// Shared cookie options. Path is critical — delete must use the same
// path the cookie was set with, otherwise the browser keeps the
// original. The `delete(name)` string form sets no Path attribute and
// the browser defaults to the response URL's directory (per RFC 6265),
// which for a POST to `/dev` resolves to `/` — not `/dev`. The cookie
// then survives "logout" because the deletion header targets a
// different (name, path) tuple.
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: COOKIE_PATH,
};

function passwordHash(password: string): Buffer {
  return createHash("sha256").update(password).digest();
}

function expectedCookieValue(): Buffer | null {
  const pw = process.env.DEV_DASHBOARD_PASSWORD;
  if (!pw) return null;
  return passwordHash(pw);
}

function constantTimeMatch(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function isDevAuthorized(): Promise<boolean> {
  const expected = expectedCookieValue();
  if (!expected) return false;

  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME)?.value;
  if (!cookie) return false;

  let provided: Buffer;
  try {
    provided = Buffer.from(cookie, "hex");
  } catch {
    return false;
  }

  return constantTimeMatch(expected, provided);
}

export async function requireDevAuth(): Promise<void> {
  if (!(await isDevAuthorized())) {
    redirect("/dev/login");
  }
}

// Returns true if the password matched and the cookie was set.
// Called only from Server Actions (cookies are mutable there).
export async function setDevAuthCookie(password: string): Promise<boolean> {
  const expected = expectedCookieValue();
  if (!expected) return false;

  const provided = passwordHash(password);
  if (!constantTimeMatch(expected, provided)) return false;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, expected.toString("hex"), {
    ...COOKIE_OPTIONS,
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return true;
}

export async function clearDevAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  // Empty value + maxAge=0 with the same path the cookie was set under.
  // Equivalent to delete() but with the path explicitly preserved.
  cookieStore.set(COOKIE_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}
