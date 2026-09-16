/** Where a member lands after signing in when nothing more specific was asked for. */
export const DEFAULT_AFTER_LOGIN = "/dashboard?tab=ai-bot";

/**
 * The ?next= target, if it is safe to follow.
 *
 * Dashboard paths only. Anything else — a full URL, "//evil.example" (which a
 * browser reads as protocol-relative, i.e. another site), a backslash variant
 * some browsers normalise to "//" — falls back to the default. Without this the
 * login page is an open redirect: a phishing link to the real /login that sends
 * the member somewhere else the moment they sign in.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AFTER_LOGIN;
  if (raw.includes("\\") || raw.startsWith("//")) return DEFAULT_AFTER_LOGIN;
  return /^\/dashboard(?:[/?#]|$)/.test(raw) ? raw : DEFAULT_AFTER_LOGIN;
}
