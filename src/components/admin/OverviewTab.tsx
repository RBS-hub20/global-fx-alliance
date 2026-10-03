"use client";

import { Bar, CARD, Empty, Head, LiveDot, Pill, Stat, Table, Td, clock, flag, type Loaded } from "./bits";

export interface Stats {
  installed: { siteEvents: boolean; crmLeads: boolean };
  truncated: boolean;
  since: string;
  now: { total: number; byPath: { path: string; visitors: number }[]; windowMinutes: number };
  today: {
    pageViews: number; uniqueVisitors: number; leadClicks: number; leadVisitors: number;
    started: number; quizCompleted: number; joinedChannel: number; verifiedDeposits: number;
  };
  funnel: { key: string; label: string; count: number; source: string; available: boolean; conversion: number | null }[];
  feed: { at: string; event: string; path: string; country: string | null; device: string | null; source: string | null }[];
  campaigns: { campaign: string; source: string | null; views: number; leads: number }[];
  series: { date: string; pageViews: number; leads: number }[];
  pixel: { pageViewsLastHour: number; lastPageViewAt: string | null; quiet: boolean };
}

/** The pages the beacon counts, in funnel order. */
const WATCHED = ["/join", "/l/free", "/"];

/*
 * The stats fetch is owned by the shell and handed down, so the header's live
 * count and this tab are the same request rather than two polls of one endpoint
 * disagreeing by a few seconds.
 */
export function OverviewTab({ loaded }: { loaded: Loaded<Stats> }) {
  const { data, error, loading } = loaded;

  if (loading && !data) return <div className={`${CARD} px-4 py-8 text-center font-mono text-[12px] text-[#737373]`}>Reading…</div>;
  if (error) return <div className={`${CARD} px-4 py-6 font-mono text-[12px] text-[#ef4444]`}>{error}</div>;
  if (!data) return null;

  const t = data.today;
  const byPath = new Map(data.now.byPath.map((p) => [p.path, p.visitors]));

  return (
    <div className="space-y-4">
      {!data.installed.siteEvents ? (
        <div className={`${CARD} border-[#facc15]/40 px-4 py-3 font-mono text-[12px] text-[#facc15]`}>
          site_events does not exist. Run supabase/20251003_admin_monitoring.sql — until then every traffic
          number on this page is zero because nothing is being recorded, not because nobody came.
        </div>
      ) : null}

      {/* ----------------------------------------------------------- live now */}
      <section className={CARD}>
        <Head right={<LiveDot live={data.now.total > 0} />}>Here now · last {data.now.windowMinutes} min</Head>
        <div className="grid gap-px bg-[#262626] sm:grid-cols-4">
          <div className="bg-[#141414] px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#737373]">All pages</p>
            <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-[#00ff88]">{data.now.total}</p>
            <p className="mt-0.5 text-[11px] text-[#737373]">distinct visitors</p>
          </div>
          {WATCHED.map((p) => (
            <div key={p} className="bg-[#141414] px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#737373]">{p === "/" ? "/ (landing)" : p}</p>
              <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-white">{byPath.get(p) ?? 0}</p>
              <p className="mt-0.5 text-[11px] text-[#737373]">on this page</p>
            </div>
          ))}
        </div>
        <footer className="border-t border-[#262626] px-4 py-2 text-[11px] leading-relaxed text-[#737373]">
          Counted from our own <code className="text-[#a3a3a3]">site_events</code> rows, one per page view on the public
          funnel, de-duplicated by a daily-rotating visitor hash. The Meta Pixel&apos;s own count lives in Events
          Manager and cannot be read back from here.
        </footer>
      </section>

      {/* ------------------------------------------------------------- today */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Page views today" value={t.pageViews} sub={`${t.uniqueVisitors} unique visitors`} tone="good" />
        <Stat label="Telegram clicks" value={t.leadClicks} sub={`${t.leadVisitors} distinct · Lead event`} />
        <Stat label="Bot /start" value={data.installed.crmLeads ? t.started : "—"}
          sub={data.installed.crmLeads ? "crm_leads rows today" : "crm_leads not installed"}
          tone={data.installed.crmLeads ? "normal" : "dim"} />
        <Stat label="Verified deposits" value={t.verifiedDeposits} sub="verified_users, approved today" />
      </div>

      {/* ------------------------------------------------------------ funnel */}
      <section className={CARD}>
        <Head right={<span className="font-mono text-[10px] text-[#737373]">since {new Date(data.since).toLocaleDateString("en-GB")} 00:00</span>}>
          Funnel · today
        </Head>
        <div className="space-y-3 p-4">
          {data.funnel.map((s, i) => {
            const top = data.funnel[0].count || 1;
            return (
              <div key={s.key}>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-[#737373]">{i + 1}</span>
                  <span className="font-mono text-[12px] text-white">{s.label}</span>
                  {!s.available ? <Pill tone="dim">no source</Pill> : null}
                  <span className="ml-auto font-mono text-[13px] font-bold tabular-nums text-[#00ff88]">
                    {s.available ? s.count : "—"}
                  </span>
                  <span className="w-14 text-right font-mono text-[11px] tabular-nums text-[#737373]">
                    {s.conversion === null ? "" : `${s.conversion}%`}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar value={s.available ? s.count : 0} of={top} tone={s.available ? "#00ff88" : "#404040"} />
                </div>
              </div>
            );
          })}
        </div>
        {!data.installed.crmLeads || data.funnel.some((s) => s.source === "crm_leads" && s.count === 0) ? (
          <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
            Stages 3–5 come from <code className="text-[#a3a3a3]">crm_leads</code>, which only the Telegram bot can fill.
            This repo has no <code className="text-[#a3a3a3]">/api/telegram/webhook</code>, so nothing writes those rows
            yet — they read as no source rather than as a 0% conversion.
          </footer>
        ) : null}
      </section>

      {/* --------------------------------------------------------- live feed */}
      <section className={CARD}>
        <Head right={<span className="font-mono text-[10px] text-[#737373]">{data.feed.length} most recent</span>}>
          Live feed
        </Head>
        {data.feed.length === 0 ? (
          <Empty title="Nothing today yet.">
            A row appears here the moment someone opens /join, /l/free or the landing page.
          </Empty>
        ) : (
          <Table head={["Time", "Event", "Page", "Country", "Source", "Device"]}>
            {data.feed.map((r, i) => (
              <tr key={`${r.at}-${i}`} className="border-b border-[#1c1c1c] last:border-0">
                <Td className="text-[#737373]">{clock(r.at)}</Td>
                <Td>{r.event === "lead" ? <Pill tone="good">lead</Pill> : <span className="text-[#737373]">view</span>}</Td>
                <Td>{r.path}</Td>
                <Td>{flag(r.country)} <span className="text-[#737373]">{r.country ?? "—"}</span></Td>
                <Td className="max-w-[260px] truncate text-[#a3a3a3]">{r.source ?? "direct"}</Td>
                <Td className="text-[#737373]">{r.device ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
        {data.truncated ? (
          <footer className="border-t border-[#262626] px-4 py-2 font-mono text-[11px] text-[#facc15]">
            Today exceeded the 5,000-row read cap — the counts above are a floor, not a total.
          </footer>
        ) : null}
      </section>

      {/* --------------------------------------------------------- campaigns */}
      <section className={CARD}>
        <Head>Top campaigns · today</Head>
        {data.campaigns.length === 0 ? (
          <Empty title="No UTM-tagged arrivals today." />
        ) : (
          <Table head={["Campaign", "utm_source", "Views", "Leads", "Rate"]}>
            {data.campaigns.map((c) => (
              <tr key={c.campaign} className="border-b border-[#1c1c1c] last:border-0">
                <Td className="max-w-[280px] truncate text-white">{c.campaign}</Td>
                <Td className="text-[#737373]">{c.source ?? "—"}</Td>
                <Td>{c.views}</Td>
                <Td className="text-[#00ff88]">{c.leads}</Td>
                <Td className="text-[#737373]">{c.views ? `${Math.round((c.leads / c.views) * 1000) / 10}%` : "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
