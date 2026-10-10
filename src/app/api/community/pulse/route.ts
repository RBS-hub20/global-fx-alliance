import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tableMissing } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 86400_000;
const LIVE_MS = 5 * 60_000;

/**
 * Real activity across the Alliance, for the Chapters page.
 *
 * Every figure here is counted from this project's own tables at request time.
 * That is the whole point of the endpoint: the alternative on the table was a
 * ticker of invented names, and the honest version is only worth building if
 * nothing in it is invented.
 *
 * Aggregates only — counts and ISO country codes, never a visitor hash, never a
 * member's address. Nothing here identifies anyone, which is what makes it safe
 * to show to every member.
 *
 * One caveat the UI repeats rather than hides: site_events covers the public
 * pages only. /dashboard is deliberately outside it, so "visitors" means people
 * who opened the public site, not members moving around the app.
 */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Server is not configured." }, { status: 503 });

  const since = new Date(Date.now() - WEEK_MS).toISOString();

  const [events, members] = await Promise.all([
    db.from("site_events").select("visitor,country,created_at").gte("created_at", since).limit(20000),
    db.from("profiles").select("status,created_at").eq("status", "approved"),
  ]);

  const rows = tableMissing(events.error?.message) ? [] : (events.data ?? []);
  const liveSince = Date.now() - LIVE_MS;

  const visitors = new Set<string>();
  const live = new Set<string>();
  const countryCount = new Map<string, number>();

  for (const r of rows) {
    visitors.add(r.visitor);
    if (new Date(r.created_at).getTime() >= liveSince) live.add(r.visitor);
    if (r.country) countryCount.set(r.country, (countryCount.get(r.country) ?? 0) + 1);
  }

  // Busiest first, so the strip leads with where the community actually is.
  const countries = Array.from(countryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => code);

  const approved = members.data ?? [];
  const newest = approved.map((m) => m.created_at).sort().slice(-1)[0] ?? null;

  return NextResponse.json(
    {
      ok: true,
      // False when the migration has not been run, so the strip can say "not
      // measured yet" instead of showing a confident zero.
      measured: !tableMissing(events.error?.message),
      visitors7d: visitors.size,
      countries7d: countries.length,
      countryCodes: countries.slice(0, 24),
      liveNow: live.size,
      approvedMembers: approved.length,
      // Date only. The time someone signed up is not interesting and the
      // precision would single them out.
      newestMemberAt: newest ? String(newest).slice(0, 10) : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
