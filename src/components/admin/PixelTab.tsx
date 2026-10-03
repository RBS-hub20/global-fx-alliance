"use client";

import { CARD, Empty, Head, Pill, Stat, Table, Td, ago, useJson, type Loaded } from "./bits";
import type { Stats } from "./OverviewTab";

interface Health {
  settings: { pixelId: string; pixelOverridden: boolean; env: { key: string; set: boolean }[] };
}

/**
 * What the code does to the pixel, stated with the commit that made it true.
 *
 * These are not measurements. A browser can confirm them in one load of the
 * Network tab, and Meta's own totals live in Events Manager — nothing in this
 * app can read them back, so nothing here pretends to.
 */
const INVARIANTS = [
  {
    event: "PageView",
    rule: "once per load, once per route change",
    how: "The base snippet fires it on load; the route effect skips the first render and fires on every navigation after.",
    fixed: "b69cc2e, 53801ee",
    detail: "It fired twice on first load for two separate reasons: a useSearchParams() object in the effect's dependencies re-ran it past the once-guard, and React materialised the <noscript> img during hydration so the browser fetched &ev=PageView&noscript=1 as well. The tag is now written with dangerouslySetInnerHTML, which keeps it text while scripting is on.",
  },
  {
    event: "ViewContent",
    rule: "once per lesson opened",
    how: "BookViewer fires it when a lesson mounts, keyed on the lesson, so paging through 7 pages is one event.",
    fixed: null,
    detail: "content_name is “Book 01 — Forex From Zero · Pips and points”.",
  },
  {
    event: "Lead",
    rule: "once per CTA click",
    how: "Fired in the click handler of JoinCta before the Telegram tab opens, on /join and /l/free.",
    fixed: null,
    detail: "The same click also writes a site_events row, which is the number counted on this page.",
  },
  {
    event: "InitiateCheckout, Purchase",
    rule: "never, yet",
    how: "Defined in lib/pixel.ts with nothing calling them — this app has no checkout; access follows a verified broker deposit.",
    fixed: null,
    detail: "Wiring them is one line each when that flow exists.",
  },
];

export function PixelTab({ loaded }: { loaded: Loaded<Stats> }) {
  const { data } = loaded;
  const { data: health } = useJson<Health>("/api/admin/health");

  const series = data?.series ?? [];
  const peak = Math.max(1, ...series.map((d) => d.pageViews));
  const weekViews = series.reduce((a, d) => a + d.pageViews, 0);
  const weekLeads = series.reduce((a, d) => a + d.leads, 0);
  const capiSet = health?.settings.env.find((e) => e.key === "META_CAPI_TOKEN")?.set;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pixel ID" value={health?.settings.pixelId ?? "…"}
          sub={health?.settings.pixelOverridden ? "from NEXT_PUBLIC_META_PIXEL_ID" : "hardcoded default"} tone="good" />
        <Stat label="Views last hour" value={data?.pixel.pageViewsLastHour ?? 0}
          sub={data?.pixel.quiet ? "nothing in an hour" : "first-party count"}
          tone={data?.pixel.quiet ? "warn" : "good"} />
        <Stat label="Last page view" value={ago(data?.pixel.lastPageViewAt ?? null)} tone="dim" />
        <Stat label="This week" value={weekViews} sub={`${weekLeads} leads`} />
      </div>

      {data?.pixel.quiet ? (
        <div className={`${CARD} border-[#facc15]/40 px-4 py-3 text-[12px] leading-relaxed text-[#facc15]`}>
          No page view in the last hour. On a pre-launch site that is usually just a quiet hour — it is flagged because
          a pixel that has stopped firing looks identical from here. Confirm by loading /join with the Network tab open:
          one request to <code>facebook.com/tr</code> and one to <code>/api/events/track</code>.
        </div>
      ) : null}

      {/* -------------------------------------------------------- the graph */}
      <section className={CARD}>
        <Head right={<span className="font-mono text-[10px] text-[#737373]">7 days · first-party</span>}>
          Page views and leads
        </Head>
        {series.length === 0 ? (
          <Empty title="No history yet." />
        ) : (
          <div className="p-4">
            <div className="flex h-40 items-end gap-2">
              {series.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="font-mono text-[10px] tabular-nums text-[#a3a3a3]">{d.pageViews || ""}</span>
                  <div className="relative flex w-full flex-1 items-end">
                    <div className="w-full rounded-t bg-[#00ff88]/25 transition-[height] duration-500"
                      style={{ height: `${(d.pageViews / peak) * 100}%` }} />
                    {/* Leads overlaid rather than stacked: the interesting thing
                        is the gap between arriving and clicking through. */}
                    <div className="absolute bottom-0 left-1/2 w-1/3 -translate-x-1/2 rounded-t bg-[#00ff88]"
                      style={{ height: `${(d.leads / peak) * 100}%` }} />
                  </div>
                  <span className="font-mono text-[9px] text-[#737373]">
                    {new Date(d.date).toLocaleDateString("en-GB", { weekday: "short" })}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-4 font-mono text-[10px] text-[#737373]">
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[#00ff88]/25" /> page views</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[#00ff88]" /> leads</span>
            </p>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------- top campaigns */}
      <section className={CARD}>
        <Head>Campaigns today · from UTM</Head>
        {!data || data.campaigns.length === 0 ? (
          <Empty title="No UTM-tagged arrivals today.">
            Tag ad links as <code className="text-[#a3a3a3]">?utm_source=meta&amp;utm_campaign=Gold_Ideas&amp;utm_content=Video1</code> —
            the values are kept for 30 days and travel into the bot&apos;s start payload.
          </Empty>
        ) : (
          <Table head={["Campaign", "Source", "Views", "Leads"]}>
            {data.campaigns.map((c) => (
              <tr key={c.campaign} className="border-b border-[#1c1c1c] last:border-0">
                <Td className="max-w-[300px] truncate text-white">{c.campaign}</Td>
                <Td className="text-[#737373]">{c.source ?? "—"}</Td>
                <Td>{c.views}</Td>
                <Td className="text-[#00ff88]">{c.leads}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {/* ------------------------------------------------------ invariants */}
      <section className={CARD}>
        <Head right={<Pill tone="dim">code, not measurement</Pill>}>What fires, and when</Head>
        <div className="divide-y divide-[#1c1c1c]">
          {INVARIANTS.map((i) => (
            <div key={i.event} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[12px] font-bold text-[#00ff88]">{i.event}</span>
                <span className="font-mono text-[11px] text-white">{i.rule}</span>
                {i.fixed ? <Pill tone="good">fixed in {i.fixed}</Pill> : null}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[#a3a3a3]">{i.how}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#737373]">{i.detail}</p>
            </div>
          ))}
        </div>
        <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
          Every count on this tab is our own <code className="text-[#a3a3a3]">site_events</code> table, not Meta&apos;s.
          Meta&apos;s totals are only readable in Events Manager
          {capiSet ? ", or through the Conversions API token that is set." : " — META_CAPI_TOKEN is not set, so there is no server-side feed either."}
        </footer>
      </section>
    </div>
  );
}
