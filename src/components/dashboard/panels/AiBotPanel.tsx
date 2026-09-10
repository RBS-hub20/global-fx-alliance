"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Check, Loader2, Lock, Plug, ShieldAlert, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { getJournalAnalytics, getBestWorst } from "@/lib/journalStore";
import { DISCLAIMER } from "@/lib/ai";

/**
 * GFXA AI Execution Bot.
 *
 * Built as a `?tab=` panel rather than its own /dashboard/ai-bot route, because
 * the brief asked for it to look like it had always been part of the dashboard.
 * This dashboard is one route driven by the tab registry — a sibling route would
 * render outside the shell and lose the sidebar, header, access gate and mobile
 * bar, which is the opposite of that.
 *
 * Nothing here is seeded. Every number is the member's own row over Realtime, so
 * an unconfigured deployment shows empty states instead of a demo that looks
 * like a working bridge.
 */

/* ------------------------------------------------------------------ tokens */

const CARD = "rounded-lg border border-[#262626] bg-[#141414]";
const GREEN = "#00ff88";
const MODE_STYLE: Record<string, string> = {
  GREEN: "border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]",
  YELLOW: "border-[#facc15] bg-[#facc15]/10 text-[#facc15]",
  RED: "border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]",
};
const MODE_MEANING: Record<string, string> = {
  GREEN: "Conditions the engine was told to trade. Proposals may appear.",
  YELLOW: "Waiting. Trend or volatility is not where it wants it — no proposals.",
  RED: "Stood down. Daily loss limit, spread, or news window.",
};

function Head({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2 border-b border-[#262626] px-4 py-2.5">
      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
        <span className="text-[#00ff88]/50">_&gt;</span> {children}
      </h3>
      {right ? <span className="ml-auto">{right}</span> : null}
    </header>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`${CARD} px-3 py-2.5`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#525252]">{label}</p>
      <p className="num-mono mt-1 text-[20px] font-bold leading-none" style={{ color: tone ?? "#e5e5e5" }}>{value}</p>
      {sub ? <p className="mt-1 text-[10.5px] text-[#a3a3a3]">{sub}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- types */

interface VtAccount {
  id: string; account_number: string; server: string; status: string;
  balance: number; telegram_id: string | null; auto_execute_enabled: boolean;
  last_connected_at: string | null;
}
interface BotStatus {
  current_symbol: string; current_mode: "GREEN" | "YELLOW" | "RED";
  adx_h1: number | null; bb_width: string | null; ema_distance: string | null;
  vt_balance: number | null; daily_pnl_percent: number | null;
  pattern_radar_signal: string | null; risk_locked: boolean; updated_at: string;
}
interface Execution {
  id: string; symbol: string; action: "BUY" | "SELL" | "CLOSE";
  price: number; sl: number | null; tp: number | null; lot: number;
  reason: string | null; status: string; expires_at: string; created_at: string;
  vps_response: Record<string, unknown> | null;
}

/* =========================================================================== */

export function AiBotPanel() {
  const { session, ready } = useAuth();
  const supabase = supabaseBrowser();

  const [accounts, setAccounts] = useState<VtAccount[] | null>(null);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [logs, setLogs] = useState<Execution[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const res = await fetch("/api/bot/status", { cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) { setNotice(j?.message ?? "Could not read the bot."); setAccounts([]); setLogs([]); return; }
    setAccounts(j.accounts ?? []);
    setStatus(j.status ?? null);
    setNotice(null);

    if (supabase) {
      const { data, error } = await supabase
        .from("execution_logs").select("*").order("created_at", { ascending: false }).limit(40);
      setLogs(error ? [] : ((data ?? []) as Execution[]));
    }
  }, [session, supabase]);

  useEffect(() => { void load(); }, [load]);

  /* --------------------------------------------------------- realtime */
  useEffect(() => {
    if (!supabase || !session) return;
    const uid = session.user.id;

    // Filtered server-side as well as by RLS: without the filter every
    // subscriber wakes on every row the policy would have let them see anyway,
    // which is wasted work rather than a leak.
    const channel = supabase
      .channel(`gfxa-bot-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "execution_logs", filter: `user_id=eq.${uid}` },
        (p) => {
          const row = p.new as Execution;
          setLogs((prev) => {
            const list = prev ?? [];
            if (p.eventType === "DELETE") return list.filter((l) => l.id !== (p.old as Execution).id);
            const without = list.filter((l) => l.id !== row.id);
            return [row, ...without].slice(0, 40);
          });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_status", filter: `user_id=eq.${uid}` },
        (p) => setStatus(p.new as BotStatus))
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [supabase, session]);

  const mode = status?.current_mode ?? "YELLOW";
  const demo = accounts?.some((a) => a.server === "VTMarkets-Demo" && a.status === "connected");

  if (!ready) return <div className="h-40 animate-pulse rounded-lg bg-[#141414]" />;
  if (!session) {
    return (
      <div className={`${CARD} p-6`}>
        <p className="text-[13px] text-[#a3a3a3]">Sign in to connect an account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
          <Bot className="h-4 w-4" strokeWidth={2.2} />
          <span className="text-[#00ff88]/50">_&gt;</span> GFXA AI EXECUTION BOT
        </h2>
        <span className="rounded border border-[#D4AF37]/40 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#D4AF37]">
          beta
        </span>
        <span className={`ml-auto rounded border px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${MODE_STYLE[mode]}`}>
          {mode} MODE
        </span>
      </header>

      {demo ? (
        <p className="rounded-lg border border-[#facc15]/40 bg-[#facc15]/10 px-4 py-2.5 font-mono text-[11.5px] text-[#facc15]">
          DEMO MODE — VTMarkets-Demo is connected. No real money is at risk.
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-4 py-2.5 font-mono text-[11.5px] text-[#ef4444]">
          {notice}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3"><VtConnect accounts={accounts} onChange={load} /></div>
        <div className="lg:col-span-5"><MarketBrain status={status} /></div>
        <div className="lg:col-span-4"><ExecutionLog logs={logs} onChange={load} /></div>
      </div>

      <JournalStrip />

      <p className="font-mono text-[10.5px] leading-relaxed text-[#D4AF37]/80">
        Educational only — not financial advice. {DISCLAIMER.replace("Educational only — not financial advice. ", "")}{" "}
        Auto-execution places real orders on a live broker account; you remain responsible for every fill.
      </p>
    </div>
  );
}

/* ------------------------------------------------------- LEFT: VT connect */

function VtConnect({ accounts, onChange }: { accounts: VtAccount[] | null; onChange: () => void }) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [type, setType] = useState<"investor" | "master">("investor");
  const [server, setServer] = useState("VTMarkets-Live");
  const [telegram, setTelegram] = useState("");
  const [auto, setAuto] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Auto-execute cannot survive a switch back to the read-only credential.
  useEffect(() => { if (type !== "master") { setAuto(false); setAck(false); } }, [type]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await fetch("/api/connect-vt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_number: account.trim(), password, password_type: type,
        server, telegram_id: telegram.trim(), auto_execute_enabled: auto, master_ack: ack,
      }),
    });
    const j = await res.json().catch(() => null);
    setBusy(false);
    // Cleared on every outcome — it should not sit in a React state tree, and
    // it must not be re-submitted by a double click.
    setPassword("");
    if (res.ok && j?.ok) { setMsg("Connected."); setAccount(""); onChange(); }
    else setMsg(j?.message ?? "Could not connect.");
  };

  return (
    <div className={CARD}>
      <Head>VT BRIDGE</Head>
      <form onSubmit={submit} className="space-y-3 p-4">
        <Field label="Account number" value={account} onChange={setAccount} placeholder="8459211" mono inputMode="numeric" />

        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#525252]">Password type</p>
          <div className="flex gap-2">
            {(["investor", "master"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
                className={`flex-1 rounded border px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
                  type === t ? "border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]" : "border-[#262626] text-[#a3a3a3] hover:text-[#e5e5e5]"
                }`}>
                {t}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#a3a3a3]">
            {type === "investor"
              ? "Read-only at the broker. The bot can watch and propose, but cannot place an order."
              : "Full trading access. Anyone holding it can open and close positions on this account."}
          </p>
        </div>

        <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="off" />

        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#525252]">Server</p>
          <select value={server} onChange={(e) => setServer(e.target.value)}
            className="w-full rounded border border-[#262626] bg-[#0a0a0a] px-2.5 py-1.5 font-mono text-[12px] text-[#e5e5e5] outline-none focus:border-[#00ff88]/50">
            <option>VTMarkets-Live</option>
            <option>VTMarkets-Demo</option>
          </select>
        </div>

        <Field label="Telegram ID (optional)" value={telegram} onChange={setTelegram} placeholder="123456789" mono />

        <label className={`flex items-start gap-2 text-[11.5px] ${type === "master" ? "text-[#e5e5e5]" : "text-[#525252]"}`}>
          <input type="checkbox" checked={auto} disabled={type !== "master"}
            onChange={(e) => setAuto(e.target.checked)} className="mt-[3px]" />
          <span>
            Enable auto-execute
            <span className="block text-[10.5px] text-[#a3a3a3]">
              {type === "master" ? "Proposals still need your approval unless the engine is set otherwise." : "Needs the master password."}
            </span>
          </span>
        </label>

        {auto ? (
          <label className="flex items-start gap-2 rounded border border-[#facc15]/40 bg-[#facc15]/[0.07] px-2.5 py-2 text-[11px] leading-relaxed text-[#facc15]">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-[3px]" />
            <span>I understand the master password lets the VPS place real trades on this account.</span>
          </label>
        ) : null}

        <button type="submit" disabled={busy || !account || !password || (auto && !ack)}
          className="w-full rounded border border-[#00ff88] bg-[#141414] px-3 py-2 font-mono text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#00ff88] transition-colors hover:bg-[#00ff88]/10 disabled:opacity-40">
          {busy ? <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" /> : <span className="text-[#00ff88]/50">_&gt; </span>}
          {busy ? "Authorising…" : "AUTHORIZE BRIDGE"}
        </button>

        {msg ? <p className="font-mono text-[11px] text-[#a3a3a3]">{msg}</p> : null}

        <p className="flex items-start gap-1.5 border-t border-[#262626] pt-2.5 text-[10.5px] leading-relaxed text-[#525252]">
          <Lock className="mt-[2px] h-3 w-3 shrink-0" strokeWidth={2} />
          Encrypted AES-256-GCM before storage. Never shown again, never returned by the API, and not readable
          by this page.
        </p>
      </form>

      <div className="border-t border-[#262626] p-4">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[#525252]">Connected accounts</p>
        {accounts === null ? (
          <div className="h-10 animate-pulse rounded bg-[#0a0a0a]" />
        ) : accounts.length === 0 ? (
          <p className="text-[11.5px] text-[#a3a3a3]">No account linked yet.</p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => <AccountRow key={a.id} a={a} onChange={onChange} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function AccountRow({ a, onChange }: { a: VtAccount; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const supabase = supabaseBrowser();

  const disconnect = async () => {
    if (!supabase) return;
    setBusy(true);
    // The delete policy is the member's own; no admin route needed to revoke.
    await supabase.from("vt_accounts").delete().eq("id", a.id);
    setBusy(false);
    onChange();
  };

  return (
    <li className="rounded border border-[#262626] bg-[#0a0a0a] px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.status === "connected" ? "bg-[#00ff88]" : "bg-[#525252]"}`} />
        <span className="num-mono text-[12px] font-semibold text-[#e5e5e5]">#{a.account_number}</span>
        <span className="num-mono ml-auto text-[12px] text-[#e5e5e5]">
          ${a.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
        <button type="button" onClick={() => void disconnect()} disabled={busy} aria-label="Disconnect"
          className="text-[#525252] transition-colors hover:text-[#ef4444] disabled:opacity-40">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#525252]">
        <span>{a.server.replace("VTMarkets-", "")}</span>
        <span>·</span>
        <span className="font-mono">•••• encrypted</span>
        {a.auto_execute_enabled ? (
          <span className="rounded border border-[#D4AF37]/40 px-1 py-px font-mono text-[9px] uppercase text-[#D4AF37]">auto</span>
        ) : null}
        {a.telegram_id ? <span className="text-[#00ff88]/70">· telegram on</span> : null}
      </div>
    </li>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, mono, autoComplete, inputMode,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; mono?: boolean; autoComplete?: string; inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.1em] text-[#525252]">{label}</span>
      <input
        type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded border border-[#262626] bg-[#0a0a0a] px-2.5 py-1.5 text-[12px] text-[#e5e5e5] placeholder:text-[#525252] outline-none focus:border-[#00ff88]/50 ${mono ? "num-mono" : ""}`}
      />
    </label>
  );
}

/* --------------------------------------------------- CENTRE: market brain */

function MarketBrain({ status }: { status: BotStatus | null }) {
  const adx = status?.adx_h1 ?? null;
  const trending = adx !== null && adx >= 25;

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <Head right={<span className="num-mono text-[10.5px] text-[#525252]">{status?.current_symbol ?? "XAUUSD"}</span>}>
          LIVE MARKET BRAIN
        </Head>

        {!status ? (
          <p className="p-4 font-mono text-[11.5px] text-[#a3a3a3]">
            The engine has not reported yet. Numbers appear here when the VPS writes its first status row —
            nothing is simulated in the meantime.
          </p>
        ) : (
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat label="ADX H1" value={adx === null ? "—" : adx.toFixed(0)}
                sub={`25 threshold · ${trending ? "trending" : "ranging"}`}
                tone={adx === null ? "#525252" : trending ? GREEN : "#a3a3a3"} />
              <Stat label="BB width" value={status.bb_width ?? "—"} sub="volatility" />
              <Stat label="EMA distance" value={status.ema_distance ?? "—"} sub="price vs mean" />
            </div>

            {adx !== null ? (
              <div>
                <div className="h-1 overflow-hidden rounded-full bg-[#262626]">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (adx / 50) * 100)}%`, background: trending ? GREEN : "#525252" }} />
                </div>
                <p className="mt-1 font-mono text-[10px] text-[#525252]">0 · 25 threshold · 50</p>
              </div>
            ) : null}

            <div className={`border-l-2 ${CARD} px-3 py-2.5`} style={{ borderLeftColor: mode(status.current_mode) }}>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#525252]">_&gt; current mode</p>
              <p className="num-mono mt-1 text-[16px] font-bold" style={{ color: mode(status.current_mode) }}>
                {status.current_mode} MODE
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#a3a3a3]">{MODE_MEANING[status.current_mode]}</p>
            </div>

            {status.pattern_radar_signal ? (
              <div className={`${CARD} px-3 py-2.5`}>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#525252]">_&gt; pattern radar</p>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[#e5e5e5]">
                  {status.pattern_radar_signal.split("+").map((s) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: /fvg/i.test(s) ? "#D4AF37" : "#3b82f6" }} />
                      {s.trim()}
                    </span>
                  ))}
                </p>
              </div>
            ) : null}

            <p className="font-mono text-[10px] text-[#525252]">
              updated {new Date(status.updated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        )}
      </div>

      <div className={CARD}>
        <Head right={<Lock className="h-3 w-3 text-[#D4AF37]" />}>RISK — LOCKED</Head>
        <ul className="divide-y divide-[#262626] text-[11.5px]">
          {[
            ["Position size", "0.01 per $1,000"],
            ["Max daily loss", "-3%"],
            ["Max spread", "60 pips"],
            ["Approval expiry", "60s"],
          ].map(([k, v]) => (
            <li key={k} className="flex items-center justify-between px-4 py-2">
              <span className="text-[#a3a3a3]">{k}</span>
              <span className="num-mono font-semibold text-[#e5e5e5]">{v}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-[#262626] px-4 py-2 text-[10.5px] text-[#525252]">
          Set server-side. Not editable from this page.
        </p>
      </div>
    </div>
  );
}

const mode = (m: string) => (m === "GREEN" ? GREEN : m === "RED" ? "#ef4444" : "#facc15");

/* --------------------------------------------------- RIGHT: execution log */

function ExecutionLog({ logs, onChange }: { logs: Execution[] | null; onChange: () => void }) {
  return (
    <div className={CARD}>
      <Head right={<span className="num-mono text-[10.5px] text-[#525252]">{logs?.length ?? 0}</span>}>EXECUTION LOG</Head>
      <div className="max-h-[560px] divide-y divide-[#262626] overflow-y-auto">
        {logs === null ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded bg-[#0a0a0a]" />)}
          </div>
        ) : logs.length === 0 ? (
          <p className="p-4 font-mono text-[11.5px] leading-relaxed text-[#a3a3a3]">
            No executions yet — bot in YELLOW waiting for GREEN.
          </p>
        ) : (
          logs.map((l) => <LogRow key={l.id} log={l} onChange={onChange} />)
        )}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PENDING_APPROVAL: "border-[#facc15]/40 bg-[#facc15]/10 text-[#facc15]",
  APPROVED: "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]",
  EXECUTED: "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]",
  REJECTED: "border-[#262626] text-[#a3a3a3]",
  EXPIRED: "border-[#262626] text-[#525252]",
  FAILED: "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444]",
};

function LogRow({ log, onChange }: { log: Execution; onChange: () => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const left = useCountdown(log.expires_at, log.status === "PENDING_APPROVAL");
  const pending = log.status === "PENDING_APPROVAL" && left > 0;

  const act = async (kind: "approve" | "reject") => {
    setBusy(kind); setErr(null);
    const res = await fetch(`/api/bot/${kind}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_id: log.id }),
    });
    const j = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok || !j?.ok) setErr(j?.message ?? "That did not go through.");
    onChange();
  };

  const buy = log.action === "BUY";

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`num-mono text-[11px] font-bold ${buy ? "text-[#00ff88]" : "text-[#ef4444]"}`}>{log.action}</span>
        <span className="num-mono text-[12px] font-semibold text-[#e5e5e5]">{log.symbol}</span>
        <span className="num-mono text-[12px] text-[#a3a3a3]">@ {Number(log.price).toFixed(2)}</span>
        <span className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${STATUS_STYLE[log.status] ?? ""}`}>
          {log.status === "PENDING_APPROVAL" && left > 0 ? `${left}s` : log.status.replace("_APPROVAL", "")}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 num-mono text-[10.5px] text-[#525252]">
        <span>lot {Number(log.lot).toFixed(2)}</span>
        {log.sl !== null ? <span>SL {Number(log.sl).toFixed(2)}</span> : null}
        {log.tp !== null ? <span>TP {Number(log.tp).toFixed(2)}</span> : null}
      </div>

      {log.reason ? <p className="mt-1 text-[11px] leading-relaxed text-[#a3a3a3]">{log.reason}</p> : null}

      {pending ? (
        <div className="mt-2.5 flex gap-2">
          <button type="button" disabled={!!busy} onClick={() => void act("approve")}
            className="flex-1 rounded border border-[#00ff88] bg-[#141414] px-2 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#00ff88] transition-colors hover:bg-[#00ff88]/10 disabled:opacity-40">
            {busy === "approve" ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : <><Check className="mr-1 inline h-3 w-3" />Approve</>}
          </button>
          <button type="button" disabled={!!busy} onClick={() => void act("reject")}
            className="rounded border border-[#262626] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#a3a3a3] transition-colors hover:text-[#e5e5e5] disabled:opacity-40">
            {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><X className="mr-1 inline h-3 w-3" />Skip</>}
          </button>
        </div>
      ) : null}

      {err ? <p className="mt-1.5 font-mono text-[10.5px] text-[#ef4444]">{err}</p> : null}
    </div>
  );
}

/** Seconds left, ticking. Returns 0 once past, so an expired card stops offering Approve. */
function useCountdown(iso: string, active: boolean): number {
  const [left, setLeft] = useState(0);
  const ref = useRef(iso);
  ref.current = iso;

  useEffect(() => {
    if (!active) { setLeft(0); return; }
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(ref.current).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  return left;
}

/* ------------------------------------------------------- BOTTOM: journal */

function JournalStrip() {
  const [stats, setStats] = useState<{ winRate: number; trades: number; wins: number; losses: number; hold: number; worst: string } | null>(null);

  // Journal data lives in this browser only, so it is read after mount rather
  // than rendered on the server.
  useEffect(() => {
    const a = getJournalAnalytics();
    if (!a) return;
    const bw = getBestWorst();
    setStats({
      winRate: a.summary.winRate, trades: a.summary.trades, wins: a.summary.wins, losses: a.summary.losses,
      hold: a.holdTime.avgWinnerMin ?? 0,
      worst: bw.worstHourDubai === null || bw.worstHourDubai === undefined ? "—" : `${String(bw.worstHourDubai).padStart(2, "0")}:00`,
    });
  }, []);

  return (
    <div className={CARD}>
      <Head right={
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#525252]">
          {stats ? "from your import" : "no import"}
        </span>
      }>
        JOURNAL ANALYTICS
      </Head>
      {!stats ? (
        <p className="p-4 text-[11.5px] text-[#a3a3a3]">
          Nothing to sync — <Link href="/dashboard?tab=journal-analytics" className="text-[#00ff88] hover:underline">import a statement</Link>{" "}
          and the bot can read your worst hour from real trades instead of assuming one.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-4">
          <Stat label="Win rate" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.wins}W-${stats.losses}L`}
            tone={stats.winRate >= 50 ? GREEN : "#ef4444"} />
          <Stat label="Trades" value={String(stats.trades)} sub="in the import" />
          <Stat label="Avg hold (win)" value={`${Math.round(stats.hold)}m`} sub="minutes" />
          <Stat label="Worst hour" value={stats.worst} sub="Dubai · consider blocking" tone="#D4AF37" />
        </div>
      )}
    </div>
  );
}
