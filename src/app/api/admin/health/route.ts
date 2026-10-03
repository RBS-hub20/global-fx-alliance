import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminApi } from "@/lib/adminGate";
import { COMMUNITY_TARGET } from "@/lib/launch";
import { META_PIXEL_ID } from "@/lib/pixel";
import { BUNDLES, MEASURED_AT, RECORDED_MEMBER_CLAIMS } from "@/lib/adminFacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tables that must be unreadable with the anon key.
 *
 * Checked by actually asking, with the anon key, from the server. An assertion
 * in a comment is not a control — this project has had the verified_users policy
 * flagged repeatedly, and the only thing that settled it was a query.
 */
const LOCKED_TABLES = [
  "profiles", "verified_users", "academy_pages", "academy_views", "academy_progress",
  "site_events", "crm_leads", "vt_accounts", "bot_status", "execution_logs",
  "member_trading_prefs", "user_streaks", "shoutbox", "analysis_votes",
];

const PRIVATE_BUCKETS = ["academy-books", "verification-proofs"];

/** Presence only. A value is never read into the response. */
const ENV_KEYS = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", need: true, why: "Supabase project URL." },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", need: true, why: "Browser auth." },
  { key: "SUPABASE_SERVICE_ROLE_KEY", need: true, why: "Server reads. Never NEXT_PUBLIC_." },
  { key: "GFXA_ADMIN_EMAILS", need: true, why: "Who may open this page." },
  { key: "GFXA_ADMIN_TOKEN", need: true, why: "Header auth for the older review routes." },
  { key: "NEXT_PUBLIC_META_PIXEL_ID", need: false, why: `Override. Falls back to ${META_PIXEL_ID}.` },
  { key: "TELEGRAM_BOT_TOKEN", need: false, why: "Set, but nothing in this repo uses it yet." },
  { key: "TELEGRAM_PUBLIC_CHANNEL_ID", need: false, why: "For the channel-join check the bot would do." },
  { key: "TELEGRAM_WEBHOOK_SECRET", need: false, why: "Would authenticate /api/telegram/webhook. Route does not exist." },
  { key: "META_CAPI_TOKEN", need: false, why: "Server-side Conversions API. Not wired." },
  { key: "ENCRYPTION_KEY", need: false, why: "AI execution bot credential storage." },
  { key: "CRON_SECRET", need: false, why: "Protects the scheduled routes." },
  { key: "TWELVE_DATA_API_KEY", need: false, why: "Market data. Falls back to Yahoo." },
  { key: "OPENAI_API_KEY", need: false, why: "AI narration. Falls back to the local engine." },
];

/** Does any NEXT_PUBLIC_ variable hold something that looks like a secret? */
function publicEnvLeaks(): string[] {
  const bad: string[] = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith("NEXT_PUBLIC_") || !v) continue;
    // A service-role JWT carries its own role claim; a stray 64-hex value is an
    // encryption key or a token. Either in a NEXT_PUBLIC_ variable is in the
    // browser bundle.
    const looksServiceRole = v.startsWith("eyJ") && Buffer.from(v.split(".")[1] ?? "", "base64").toString().includes("service_role");
    const looksKey = /^[a-f0-9]{64}$/i.test(v) || /^sk-[A-Za-z0-9_-]{20,}$/.test(v);
    if (looksServiceRole || looksKey) bad.push(k);
  }
  return bad;
}

export async function GET(request: Request) {
  const ctx = await adminApi();
  if (ctx instanceof NextResponse) return ctx;
  const { db } = ctx;

  /* ------------------------------------------------------------------ RLS */

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let rls: { table: string; verdict: string; detail: string }[] = [];
  let anonInsert = { verdict: "skipped", detail: "No anon key configured." };

  if (anonKey) {
    const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

    rls = await Promise.all(
      LOCKED_TABLES.map(async (table) => {
        const { data, error } = await anon.from(table).select("*", { head: false }).limit(1);
        if (error) {
          // "does not exist" is a missing migration, not a hole.
          if (/does not exist|schema cache/i.test(error.message)) {
            return { table, verdict: "absent", detail: "Table not installed." };
          }
          return { table, verdict: "locked", detail: `Refused: ${error.code ?? error.message}` };
        }
        return (data ?? []).length === 0
          ? { table, verdict: "locked", detail: "Readable but returns no rows." }
          : { table, verdict: "LEAK", detail: `anon read ${(data ?? []).length} row(s).` };
      })
    );

    /*
     * Write test. The broker value violates the table's own check constraint, so
     * even if RLS were wide open this cannot leave a row behind — the cost of
     * that safety is that a 23514 is inconclusive rather than a pass, which the
     * verdict says rather than rounding up to "secure".
     */
    const ins = await anon.from("verified_users")
      .insert({ email: "rls-probe@invalid.local", broker: "__probe__", account_number: "0" });
    const code = ins.error?.code ?? null;
    anonInsert = !ins.error
      ? { verdict: "LEAK", detail: "anon insert succeeded." }
      : code === "42501"
        ? { verdict: "locked", detail: "42501 — insufficient privilege." }
        : { verdict: "inconclusive", detail: `Refused with ${code ?? ins.error.message}, not 42501.` };
  }

  /* -------------------------------------------------------------- storage */

  const buckets = await Promise.all(
    PRIVATE_BUCKETS.map(async (id) => {
      const { data, error } = await db.storage.getBucket(id);
      if (error) return { id, verdict: "unknown", detail: error.message };
      return data?.public
        ? { id, verdict: "PUBLIC", detail: "Anyone with the path can read every object." }
        : { id, verdict: "private", detail: "Signed URLs only." };
    })
  );

  /* --------------------------------------------------------------- guards */

  /*
   * Asks this deployment's own API, with no cookies, what an anonymous caller
   * gets. 401 is the correct answer and the regression this catches is real:
   * 4e2451e once removed the session check from the academy route entirely and
   * nothing noticed until an anonymous curl returned a working signed URL.
   */
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host");
  const origin = host ? `${proto}://${host}` : null;

  const probe = async (path: string, expect: number) => {
    if (!origin) return { path, verdict: "skipped", detail: "No host header.", expect };
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 4000);
    try {
      const res = await fetch(`${origin}${path}`, { signal: ac.signal, cache: "no-store", headers: { "x-gfxa-probe": "1" } });
      return {
        path, expect, status: res.status,
        verdict: res.status === expect ? "ok" : "UNEXPECTED",
        detail: `${res.status} (expected ${expect})`,
      };
    } catch (e) {
      return { path, expect, verdict: "unreachable", detail: e instanceof Error ? e.message : "failed" };
    } finally {
      clearTimeout(timer);
    }
  };

  const guards = await Promise.all([
    probe("/api/academy/page?lesson=1&page=1", 401),
    probe("/api/academy/books", 401),
    probe("/api/admin/stats", 401),
    probe("/api/admin/pending", 401),
  ]);

  /* ------------------------------------------------------------ the claims */

  const approved = await db.from("profiles").select("id", { count: "exact", head: true }).eq("status", "approved");
  const members = await db.from("profiles").select("id", { count: "exact", head: true });

  const claims = [
    ...RECORDED_MEMBER_CLAIMS,
    { where: "src/lib/launch.ts:31", shown: String(COMMUNITY_TARGET.members), note: "COMMUNITY_TARGET.members, verified: false — read live." },
  ];
  const distinct = Array.from(new Set(claims.map((c) => c.shown)));

  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;

  return NextResponse.json(
    {
      ok: true,
      security: {
        rls,
        anonInsert,
        buckets,
        guards,
        publicEnvLeaks: publicEnvLeaks(),
        commit,
        commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
        bundles: BUNDLES,
        // Numbers from a build, not from this request — say so rather than
        // letting them read as live.
        bundlesMeasuredAt: MEASURED_AT,
      },
      settings: {
        env: ENV_KEYS.map((e) => ({ ...e, set: !!process.env[e.key] })),
        pixelId: META_PIXEL_ID,
        pixelOverridden: !!process.env.NEXT_PUBLIC_META_PIXEL_ID,
        memberClaims: claims,
        claimsAgree: distinct.length === 1,
        actual: { accounts: members.count ?? 0, approved: approved.count ?? 0 },
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
