/**
 * Shared environment check for the Academy scripts.
 *
 * `vercel env pull` writes "[SENSITIVE]" in place of secret values, so a file
 * that looks complete can still carry no usable key — which is what turned an
 * auth failure into the misleading "Book 1 is not seeded".
 */
export function academyEnv() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "  set -a; source .env.local; set +a"
    );
  }
  if (key === "[SENSITIVE]" || !key.startsWith("ey")) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY is "${key.slice(0, 16)}", not a key.\n` +
      "  `vercel env pull` redacts secrets, so .env.local cannot supply this one.\n" +
      "  Copy the service_role key from Supabase → Project Settings → API, then either\n" +
      "  paste it into .env.local or run the command with it inline:\n" +
      "    SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/<script>.mjs ..."
    );
  }
  return { url, key };
}

/** Turns a PostgREST failure into the reason it actually happened. */
export function explain(error) {
  const m = error?.message ?? String(error);
  if (/JWT|invalid|unauthor/i.test(m)) return `${m} — the service_role key was rejected.`;
  if (/does not exist|schema cache/i.test(m)) return `${m} — run the academy migration first.`;
  return m;
}
