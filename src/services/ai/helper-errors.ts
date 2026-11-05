// Turns whatever went wrong in a helper turn into words for the staff
// member: a plain explanation plus the exact technical reason. Staff are
// the only people who use the helper, so showing the detail is fine and
// saves a trip to the logs. Never includes secrets: API errors don't echo
// the key.

export interface HelperErrorDescription {
  text: string;
  detail: string;
}

type ApiLikeError = {
  name?: string;
  message?: string;
  status?: number;
  error?: { error?: { type?: string; message?: string } };
  issues?: ReadonlyArray<{ path?: ReadonlyArray<PropertyKey>; message?: string }>;
};

const MAX_DETAIL = 600;

export function describeHelperError(error: unknown): HelperErrorDescription {
  const err = (typeof error === "object" && error !== null ? error : {}) as ApiLikeError;
  const apiMessage = err.error?.error?.message;
  const raw = apiMessage ?? err.message ?? String(error);
  const detail = `${err.status ? `${err.status} ` : ""}${err.name && err.name !== "Error" ? `${err.name}: ` : ""}${raw}`.slice(0, MAX_DETAIL);

  if (err.name === "ZodError" && err.issues) {
    const issues = err.issues.map((issue) => `${(issue.path ?? []).join(".")}: ${issue.message}`).join("; ");
    return { text: "The helper's draft didn't fit the event form, so nothing was saved.", detail: issues.slice(0, MAX_DETAIL) };
  }
  if (/api[_ ]?key|ANTHROPIC_API_KEY|authentication/i.test(raw) || err.status === 401 || err.status === 403) {
    return { text: "The AI key isn't set up or isn't valid (ANTHROPIC_API_KEY in Vercel's settings).", detail };
  }
  if (err.status === 429) return { text: "The AI service is limiting how fast we can ask. Wait a minute and try again.", detail };
  if (err.status === 529 || err.error?.error?.type === "overloaded_error") {
    return { text: "The AI service is busy right now. Try again in a minute.", detail };
  }
  if (err.name === "APIConnectionTimeoutError" || /timed? ?out/i.test(raw)) {
    return { text: "The AI took too long to answer. Try again, or a shorter message.", detail };
  }
  if (err.name === "APIConnectionError") return { text: "Couldn't reach the AI service.", detail };
  if (err.status === 400) return { text: "The AI service turned the request down.", detail };
  return { text: "The helper hit a problem.", detail };
}
