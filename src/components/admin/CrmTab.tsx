"use client";

import { useMemo, useState } from "react";
import { CARD, Empty, Head, Pill, Stat, Table, Td, day, useJson } from "./bits";

interface Lead {
  id: string;
  telegram_id: number | null;
  telegram_username: string | null;
  name: string | null;
  phone: string | null;
  country: string | null;
  experience: string | null;
  goal: string | null;
  start_param: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  status: "started" | "completed_quiz" | "joined_channel" | "contacted" | "verified";
  created_at: string;
}

interface Payload {
  installed: boolean;
  writer: boolean;
  leads: Lead[];
  stats: { total: number; joined: number; today: number };
  message?: string;
}

const STATUS_TONE: Record<Lead["status"], "good" | "warn" | "dim" | "bad"> = {
  started: "dim", completed_quiz: "warn", joined_channel: "good", contacted: "warn", verified: "good",
};

const RANGES = [["all", "All time"], ["today", "Today"], ["week", "This week"]] as const;
const STATUSES = ["started", "completed_quiz", "joined_channel", "contacted", "verified"] as const;

const SELECT = "rounded border border-[#262626] bg-[#0f0f0f] px-2 py-1.5 font-mono text-[11px] text-[#d4d4d4] outline-none focus:border-[#00ff88]/50";

export function CrmTab() {
  const [range, setRange] = useState<string>("all");
  const [status, setStatus] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ range });
    if (status) p.set("status", status);
    if (source) p.set("source", source);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [range, status, source, q]);

  const { data, error, loading, reload } = useJson<Payload>(`/api/admin/crm?${query}`);

  async function mark(id: string, next: Lead["status"]) {
    setBusy(id);
    try {
      await fetch("/api/admin/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      reload();
    } finally {
      setBusy(null);
    }
  }

  // Offered from whatever arrived, so the filter cannot list a campaign that has
  // no rows behind it.
  const sources = Array.from(new Set((data?.leads ?? []).map((l) => l.utm_source).filter(Boolean))) as string[];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total leads" value={data?.stats.total ?? 0} tone="good" />
        <Stat label="Joined channel" value={data?.stats.joined ?? 0} sub="or further along" />
        <Stat label="New today" value={data?.stats.today ?? 0} />
      </div>

      {data && !data.installed ? (
        <div className={`${CARD} border-[#facc15]/40 px-4 py-3 font-mono text-[12px] text-[#facc15]`}>
          {data.message}
        </div>
      ) : null}

      {data?.installed && !data.writer ? (
        <div className={`${CARD} px-4 py-3 text-[12px] leading-relaxed text-[#a3a3a3]`}>
          <strong className="font-mono text-[#facc15]">The table is empty because nothing writes to it.</strong>{" "}
          @gfxa_access_bot runs outside this repository and there is no <code>/api/telegram/webhook</code> here, so a
          visitor who taps the CTA is counted as a Lead on the Overview tab and then disappears from our side. The
          columns, filters and export below are ready for the rows; the webhook that produces them is a separate build.
        </div>
      ) : null}

      <section className={CARD}>
        <Head right={
          <a href={`/api/admin/crm?${query}&format=csv`}
            className="rounded border border-[#00ff88]/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#00ff88] hover:bg-[#00ff88]/10">
            Export CSV
          </a>
        }>
          Leads
        </Head>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#262626] px-4 py-3">
          <select value={range} onChange={(e) => setRange(e.target.value)} className={SELECT}>
            {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={SELECT}>
            <option value="">Any source</option>
            <option value="meta">meta</option>
            {sources.filter((s) => s !== "meta").map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="name, phone, @handle"
            className={`${SELECT} min-w-[180px] flex-1`} />
          <button onClick={reload} className={`${SELECT} hover:border-[#00ff88]/50`}>{loading ? "…" : "Refresh"}</button>
        </div>

        {error ? <div className="px-4 py-4 font-mono text-[12px] text-[#ef4444]">{error}</div> : null}

        {data && data.leads.length === 0 && data.installed ? (
          <Empty title="No leads match.">
            Once the webhook exists, a <code>/start</code> with payload{" "}
            <code className="text-[#a3a3a3]">join_page_Gold_Ideas_Video1</code> becomes one row here, attributable to
            that ad.
          </Empty>
        ) : null}

        {data && data.leads.length > 0 ? (
          <Table head={["Name", "Telegram", "Country", "Experience", "Goal", "Source", "Status", "Date", "Actions"]}>
            {data.leads.map((l) => (
              <tr key={l.id} className="border-b border-[#1c1c1c] last:border-0">
                <Td className="text-white">{l.name ?? "—"}</Td>
                <Td className="text-[#a3a3a3]">{l.telegram_username ? `@${l.telegram_username}` : "—"}</Td>
                <Td>{l.country ?? "—"}</Td>
                <Td className="text-[#737373]">{l.experience ?? "—"}</Td>
                <Td className="max-w-[200px] truncate text-[#737373]">{l.goal ?? "—"}</Td>
                <Td className="max-w-[220px] truncate text-[#a3a3a3]">{l.start_param ?? l.utm_campaign ?? "—"}</Td>
                <Td><Pill tone={STATUS_TONE[l.status]}>{l.status.replace("_", " ")}</Pill></Td>
                <Td className="text-[#737373]">{day(l.created_at)}</Td>
                <Td>
                  <span className="flex items-center gap-1.5">
                    {l.telegram_username ? (
                      <a href={`https://t.me/${l.telegram_username}`} target="_blank" rel="noopener noreferrer"
                        className="text-[#00ff88] hover:underline">Telegram</a>
                    ) : null}
                    {l.phone ? (
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                        className="text-[#00ff88] hover:underline">WhatsApp</a>
                    ) : null}
                    {l.status !== "contacted" && l.status !== "verified" ? (
                      <button onClick={() => void mark(l.id, "contacted")} disabled={busy === l.id}
                        className="text-[#a3a3a3] hover:text-white disabled:opacity-40">
                        {busy === l.id ? "…" : "Mark contacted"}
                      </button>
                    ) : null}
                  </span>
                </Td>
              </tr>
            ))}
          </Table>
        ) : null}
      </section>
    </div>
  );
}
