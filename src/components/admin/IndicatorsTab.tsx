"use client";

import { useMemo, useState } from "react";
import { CARD, Empty, Head, Pill, Stat, Table, Td, day, useJson } from "./bits";

interface Request {
  id: string;
  email: string;
  memberStatus: string | null;
  telegramId: number | null;
  handle: string;
  slug: string;
  indicator: string;
  status: "pending" | "approved" | "revoked";
  note: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  expired: boolean;
}

interface Definition {
  slug: string; name: string; symbol: string | null; timeframe: string | null; status: string;
  statsVerified: boolean; winRate: number | null; profitFactor: number | null; testedMonths: number | null;
  pending: number; approved: number; revoked: number;
}

interface Payload {
  installed: boolean;
  message?: string;
  requests: Request[];
  indicators: Definition[];
  stats: { pending: number; approved: number; revoked: number; accessDays: number };
}

const TONE: Record<Request["status"], "good" | "warn" | "bad"> = {
  approved: "good", pending: "warn", revoked: "bad",
};
const SELECT = "rounded border border-[#262626] bg-[#0f0f0f] px-2 py-1.5 font-mono text-[11px] text-[#d4d4d4] outline-none focus:border-[#00ff88]/50";
const BTN = "rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider disabled:opacity-40";

/**
 * Indicator invites — management only.
 *
 * The showcase members see is /dashboard?tab=indicators. What is here is the
 * decision and the one thing that cannot be automated: TradingView has no public
 * API for adding a username to an invite-only script, so approving a row tells
 * you to go and paste the handle, and the Copy button is the point of the table.
 */
export function IndicatorsTab() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [status, q]);

  const { data, error, loading, reload } = useJson<Payload>(`/api/admin/indicators?${query}`);

  async function act(id: string, action: "approve" | "revoke") {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const j = await res.json();
      // The reminder is the actionable half of an approval, so it is surfaced
      // rather than swallowed.
      setNote(j.reminder ?? j.message ?? null);
      reload();
    } finally {
      setBusy(null);
    }
  }

  async function copy(handle: string) {
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(handle);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setNote(`Clipboard refused — the handle is ${handle}`);
    }
  }

  const unpublished = (data?.indicators ?? []).filter((i) => !i.statsVerified).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Awaiting invite" value={data?.stats.pending ?? 0}
          tone={(data?.stats.pending ?? 0) > 0 ? "warn" : "good"} sub="paste the handle in TradingView" />
        <Stat label="Active invites" value={data?.stats.approved ?? 0} tone="good"
          sub={`${data?.stats.accessDays ?? 365}-day term`} />
        <Stat label="Revoked" value={data?.stats.revoked ?? 0} tone="dim" />
        <Stat label="Indicators" value={data?.indicators.length ?? 0}
          sub={unpublished ? `${unpublished} with stats unpublished` : "all stats published"}
          tone={unpublished ? "warn" : "good"} />
      </div>

      {note ? (
        <div className={`${CARD} border-[#00ff88]/40 px-4 py-3 font-mono text-[12px] text-[#00ff88]`}>
          {note}
          <button onClick={() => setNote(null)} className="ml-3 text-[#737373] hover:text-white">dismiss</button>
        </div>
      ) : null}

      {data && !data.installed ? (
        <div className={`${CARD} border-[#facc15]/40 px-4 py-3 font-mono text-[12px] text-[#facc15]`}>{data.message}</div>
      ) : null}

      {/* ----------------------------------------------------- per indicator */}
      <section className={CARD}>
        <Head right={
          <a href="https://www.tradingview.com/pine-editor/" target="_blank" rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-wider text-[#00ff88] hover:underline">
            Pine editor ↗
          </a>
        }>
          Catalogue
        </Head>
        {data?.indicators.length ? (
          <Table head={["Indicator", "Market", "Stats", "Published", "Pending", "Active", "Revoked", "State"]}>
            {data.indicators.map((i) => (
              <tr key={i.slug} className="border-b border-[#1c1c1c] last:border-0">
                <Td className="text-white">{i.name}<span className="ml-2 text-[#525252]">{i.slug}</span></Td>
                <Td className="text-[#737373]">{i.symbol ?? "—"} · {i.timeframe ?? "—"}</Td>
                <Td className="text-[#a3a3a3]">
                  {i.winRate ?? "—"}% · PF {i.profitFactor ?? "—"} · {i.testedMonths ?? "—"}m
                </Td>
                <Td><Pill tone={i.statsVerified ? "good" : "warn"}>{i.statsVerified ? "live" : "hidden"}</Pill></Td>
                <Td className="text-[#facc15]">{i.pending}</Td>
                <Td className="text-[#00ff88]">{i.approved}</Td>
                <Td className="text-[#737373]">{i.revoked}</Td>
                <Td><Pill tone={i.status === "active" ? "good" : "dim"}>{i.status}</Pill></Td>
              </tr>
            ))}
          </Table>
        ) : <Empty title="No indicators defined." />}
        <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
          <strong className="text-[#facc15]">Published &ldquo;hidden&rdquo;</strong> means the member showcase shows
          &ldquo;Backtest pending&rdquo; instead of the win rate. The figures above are seeded but unverified — publish one
          only when you can produce the backtest behind it:{" "}
          <code className="text-[#a3a3a3]">update indicator_definitions set stats_verified = true where slug = &apos;gold-sniper&apos;;</code>
        </footer>
      </section>

      {/* -------------------------------------------------------- requests */}
      <section className={CARD}>
        <Head right={<button onClick={reload} className="font-mono text-[10px] uppercase tracking-wider text-[#737373] hover:text-white">{loading ? "…" : "refresh"}</button>}>
          Invite requests
        </Head>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#262626] px-4 py-3">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT}>
            <option value="">Any status</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="revoked">revoked</option>
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="TradingView username"
            className={`${SELECT} min-w-[200px] flex-1`} />
        </div>

        {error ? <div className="px-4 py-4 font-mono text-[12px] text-[#ef4444]">{error}</div> : null}

        {data && data.requests.length === 0 && data.installed ? (
          <Empty title="No requests yet.">
            A row appears when an approved member with a verified deposit sends their TradingView username from
            /dashboard?tab=indicators.
          </Empty>
        ) : null}

        {data && data.requests.length > 0 ? (
          <Table head={["Requested", "Member", "Telegram", "TradingView", "Indicator", "Status", "Approved", "Expires", "Actions"]}>
            {data.requests.map((r) => (
              <tr key={r.id} className="border-b border-[#1c1c1c] last:border-0">
                <Td className="text-[#737373]">{day(r.createdAt)}</Td>
                <Td className="text-white">{r.email}
                  {r.memberStatus && r.memberStatus !== "approved"
                    ? <span className="ml-2"><Pill tone="bad">{r.memberStatus}</Pill></span> : null}
                </Td>
                <Td className="text-[#737373]">{r.telegramId ?? "—"}</Td>
                <Td className="font-bold text-[#00ff88]">{r.handle}</Td>
                <Td className="text-[#a3a3a3]">{r.indicator}</Td>
                <Td>
                  <Pill tone={TONE[r.status]}>{r.status}</Pill>
                  {r.expired && r.status === "approved" ? <span className="ml-1"><Pill tone="warn">lapsed</Pill></span> : null}
                </Td>
                <Td className="text-[#737373]">{day(r.approvedAt)}</Td>
                <Td className="text-[#737373]">{day(r.expiresAt)}</Td>
                <Td>
                  <span className="flex gap-1.5">
                    <button onClick={() => void copy(r.handle)} className={`${BTN} border-[#404040] text-[#a3a3a3] hover:text-white`}>
                      {copied === r.handle ? "Copied" : "Copy"}
                    </button>
                    {r.status !== "approved" ? (
                      <button disabled={busy === r.id} onClick={() => void act(r.id, "approve")}
                        className={`${BTN} border-[#00ff88]/40 text-[#00ff88] hover:bg-[#00ff88]/10`}>
                        {busy === r.id ? "…" : "Approve"}
                      </button>
                    ) : null}
                    {r.status !== "revoked" ? (
                      <button disabled={busy === r.id} onClick={() => void act(r.id, "revoke")}
                        className={`${BTN} border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/10`}>
                        Revoke
                      </button>
                    ) : null}
                  </span>
                </Td>
              </tr>
            ))}
          </Table>
        ) : null}

        <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
          Approving records the decision and starts the {data?.stats.accessDays ?? 365}-day clock — it does not grant
          anything on its own. Copy the handle and add it to the script&apos;s invite-only list in TradingView; revoking
          is the same step in reverse. Requests only reach this table from members who are both approved and
          deposit-verified, so the gate is already applied.
        </footer>
      </section>
    </div>
  );
}
