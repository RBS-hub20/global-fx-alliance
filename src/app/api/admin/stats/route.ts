import { NextResponse } from "next/server";
import { adminApi, startOfDay, tableMissing } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How recent a visitor's last event can be and still count as "here now". */
const LIVE_WINDOW_MS = 5 * 60_000;
/*
 * PostgREST cannot do count(distinct), so unique visitors are counted in JS from
 * the day's rows. At this traffic level one query covers the whole day; the cap
 * exists so a traffic spike degrades into "≥5000, truncated" instead of a
 * timeout, and the response says which it is.
 */
const ROW_CAP = 5000;

type Row = {
  event: string; path: string; visitor: string; country: string | null; device: string | null;
  utm_source: string | null; utm_campaign: string | null; utm_content: string | null;
  start_param: string | null; created_at: string;
};

export async function GET() {
  const ctx = await adminApi();
  if (ctx instanceof NextResponse) return ctx;
  const { db } = ctx;

  const since = startOfDay();
  const liveSince = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();

  const [events, leads, deposits, lastView] = await Promise.all([
    db.from("site_events")
      .select("event,path,visitor,country,device,utm_source,utm_campaign,utm_content,start_param,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
    db.from("crm_leads").select("status,created_at").gte("created_at", since).limit(ROW_CAP),
    db.from("verified_users").select("status,verified_at").eq("status", "verified").gte("verified_at", since).limit(ROW_CAP),
    // Independent of the day boundary: "when did the pixel last fire" must still
    // answer at 00:05, when today's table is empty.
    db.from("site_events").select("created_at").eq("event", "page_view").order("created_at", { ascending: false }).limit(1),
  ]);

  const eventsInstalled = !tableMissing(events.error?.message);
  const crmInstalled = !tableMissing(leads.error?.message);

  if (events.error && eventsInstalled) {
    return NextResponse.json({ ok: false, message: events.error.message }, { status: 502 });
  }

  const rows = (events.data ?? []) as Row[];
  const truncated = rows.length >= ROW_CAP;

  /* ------------------------------------------------------------ live now */

  const liveByPath = new Map<string, Set<string>>();
  const liveAll = new Set<string>();
  for (const r of rows) {
    if (r.created_at < liveSince) continue;
    liveAll.add(r.visitor);
    const set = liveByPath.get(r.path) ?? new Set<string>();
    set.add(r.visitor);
    liveByPath.set(r.path, set);
  }

  /* --------------------------------------------------------------- today */

  const uniques = new Set<string>();
  const leadVisitors = new Set<string>();
  let pageViews = 0;
  let leadClicks = 0;
  for (const r of rows) {
    uniques.add(r.visitor);
    if (r.event === "page_view") pageViews += 1;
    if (r.event === "lead") { leadClicks += 1; leadVisitors.add(r.visitor); }
  }

  const leadRows = (leads.data ?? []) as { status: string; created_at: string }[];
  // The status column is a ladder — 'verified' implies every step before it —
  // so each stage counts itself and everything above it.
  const atLeast = (...stages: string[]) => leadRows.filter((l) => stages.includes(l.status)).length;
  const started = leadRows.length;
  const quiz = atLeast("completed_quiz", "joined_channel", "contacted", "verified");
  const joined = atLeast("joined_channel", "contacted", "verified");
  const verifiedToday = (deposits.data ?? []).length;

  /* -------------------------------------------------------------- funnel */

  const stages = [
    { key: "page_view", label: "Page view", count: uniques.size, source: "site_events", available: eventsInstalled },
    { key: "lead", label: "Clicked Telegram", count: leadVisitors.size, source: "site_events", available: eventsInstalled },
    { key: "started", label: "/start the bot", count: started, source: "crm_leads", available: crmInstalled },
    { key: "quiz", label: "Completed quiz", count: quiz, source: "crm_leads", available: crmInstalled },
    { key: "joined", label: "Joined channel", count: joined, source: "crm_leads", available: crmInstalled },
    { key: "verified", label: "Verified deposit", count: verifiedToday, source: "verified_users", available: !deposits.error },
  ];
  const funnel = stages.map((s, i) => {
    const prev = stages[i - 1];
    // Only a percentage of a stage that is itself being counted. Dividing by a
    // stage nothing writes to would read as a 0% conversion rather than as a
    // missing integration.
    const conversion = i === 0 || !prev || !prev.available || !s.available || prev.count === 0
      ? null
      : Math.round((s.count / prev.count) * 1000) / 10;
    return { ...s, conversion };
  });

  /* ----------------------------------------------------------- live feed */

  const feed = rows.slice(0, 60).map((r) => ({
    at: r.created_at,
    event: r.event,
    path: r.path,
    country: r.country,
    device: r.device,
    // The start payload is the precise source; the UTMs are the fallback.
    source: r.start_param || r.utm_campaign || r.utm_source || null,
    utmSource: r.utm_source,
  }));

  /* ----------------------------------------------------------- campaigns */

  const byCampaign = new Map<string, { campaign: string; source: string | null; views: number; leads: number }>();
  for (const r of rows) {
    const campaign = r.utm_campaign ?? (r.utm_source ? `(${r.utm_source}, no campaign)` : "(direct)");
    const agg = byCampaign.get(campaign) ?? { campaign, source: r.utm_source, views: 0, leads: 0 };
    if (r.event === "page_view") agg.views += 1;
    if (r.event === "lead") agg.leads += 1;
    byCampaign.set(campaign, agg);
  }
  const campaigns = Array.from(byCampaign.values()).sort((a, b) => b.views - a.views).slice(0, 12);

  /* ----------------------------------------------------- seven-day series */

  /*
   * Counted with exact head queries rather than by reading a week of rows: two
   * cheap counts per day beats one unbounded select, and the numbers are not
   * subject to the row cap above.
   */
  const days = await Promise.all(
    Array.from({ length: 7 }, (_, i) => 6 - i).map(async (back) => {
      const from = new Date(new Date(since).getTime() - back * 86400_000);
      const to = new Date(from.getTime() + 86400_000);
      const [v, l] = await Promise.all([
        db.from("site_events").select("id", { count: "exact", head: true }).eq("event", "page_view")
          .gte("created_at", from.toISOString()).lt("created_at", to.toISOString()),
        db.from("site_events").select("id", { count: "exact", head: true }).eq("event", "lead")
          .gte("created_at", from.toISOString()).lt("created_at", to.toISOString()),
      ]);
      return { date: from.toISOString().slice(0, 10), pageViews: v.count ?? 0, leads: l.count ?? 0 };
    })
  );

  /* --------------------------------------------------------- pixel health */

  const pageViewsLastHour = rows.filter((r) => r.event === "page_view" && r.created_at >= hourAgo).length;
  const lastPageViewAt = (lastView.data ?? [])[0]?.created_at ?? null;

  return NextResponse.json(
    {
      ok: true,
      installed: { siteEvents: eventsInstalled, crmLeads: crmInstalled },
      truncated,
      since,
      now: {
        total: liveAll.size,
        byPath: Array.from(liveByPath.entries()).map(([path, set]) => ({ path, visitors: set.size }))
          .sort((a, b) => b.visitors - a.visitors),
        windowMinutes: LIVE_WINDOW_MS / 60_000,
      },
      today: {
        pageViews,
        uniqueVisitors: uniques.size,
        leadClicks,
        leadVisitors: leadVisitors.size,
        started,
        quizCompleted: quiz,
        joinedChannel: joined,
        verifiedDeposits: verifiedToday,
      },
      funnel,
      feed,
      campaigns,
      series: eventsInstalled ? days : [],
      pixel: {
        pageViewsLastHour,
        lastPageViewAt,
        // Not an error on its own — a quiet hour on a pre-launch site is normal.
        // It is flagged because a pixel that stopped firing looks exactly the same.
        quiet: eventsInstalled && pageViewsLastHour === 0,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
