"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared furniture for the admin console.
 *
 * Same palette as the member terminal (TerminalBits) so this does not read as a
 * different product, but nothing is imported from it — those components know
 * about trade modes and entry zones, which have no meaning here.
 */

export const CARD = "rounded-lg border border-[#262626] bg-[#141414]";
export const GREEN = "#00ff88";
export const MUTED = "#737373";

export function Head({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2 border-b border-[#262626] px-4 py-2.5">
      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
        <span className="text-[#00ff88]/50">_&gt;</span> {children}
      </h3>
      {right ? <span className="ml-auto">{right}</span> : null}
    </header>
  );
}

export function Stat({ label, value, sub, tone = "normal" }: {
  label: string; value: string | number; sub?: string; tone?: "normal" | "good" | "warn" | "bad" | "dim";
}) {
  const colour = tone === "good" ? "text-[#00ff88]" : tone === "warn" ? "text-[#facc15]"
    : tone === "bad" ? "text-[#ef4444]" : tone === "dim" ? "text-[#737373]" : "text-white";
  return (
    <div className={`${CARD} px-4 py-3`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#737373]">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold tabular-nums ${colour}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] leading-snug text-[#737373]">{sub}</p> : null}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "dim"; children: React.ReactNode }) {
  const style = tone === "good" ? "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]"
    : tone === "warn" ? "border-[#facc15]/40 bg-[#facc15]/10 text-[#facc15]"
    : tone === "bad" ? "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444]"
    : "border-[#404040] bg-[#1c1c1c] text-[#a3a3a3]";
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${style}`}>
      {children}
    </span>
  );
}

/** Pulsing only while something is actually arriving. */
export function LiveDot({ live }: { live: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
      style={{ color: live ? GREEN : MUTED }}>
      <span className="relative flex h-2 w-2">
        {live ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff88] opacity-70" /> : null}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: live ? GREEN : "#404040" }} />
      </span>
      {live ? "live" : "quiet"}
    </span>
  );
}

export function Bar({ value, of, tone = GREEN }: { value: number; of: number; tone?: string }) {
  const pct = of > 0 ? Math.min(100, (value / of) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#1c1c1c]">
      <div className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: tone, boxShadow: `0 0 12px ${tone}55` }} />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="font-mono text-[12px] text-[#a3a3a3]">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-[#737373]">{children}</p> : null}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#262626]">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <td className={`whitespace-nowrap px-3 py-2 font-mono text-[12px] text-[#d4d4d4] ${className}`}>{children}</td>
);

/* ------------------------------------------------------------------ fetching */

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  updatedAt: number | null;
}

/**
 * One JSON endpoint, optionally polled.
 *
 * Polling rather than SSE: an EventSource would hold a serverless function open
 * for the life of the tab, and the numbers here change on the order of seconds,
 * not milliseconds. The in-flight guard stops a slow response from stacking up
 * behind the interval.
 */
export function useJson<T>(url: string, intervalMs = 0): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as T & { ok?: boolean; message?: string };
      if (!res.ok || json.ok === false) throw new Error(json.message || `HTTP ${res.status}`);
      setData(json);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void load();
    if (!intervalMs) return;
    const t = setInterval(() => void load(), intervalMs);
    return () => clearInterval(t);
  }, [load, intervalMs]);

  return { data, error, loading, reload: load, updatedAt };
}

/* ------------------------------------------------------------------ format */

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const ago = (iso: string | null): string => {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

/** ISO 3166-1 alpha-2 to the flag emoji, which is just two regional indicators. */
export const flag = (cc: string | null | undefined): string => {
  if (!cc || cc.length !== 2 || !/^[a-z]{2}$/i.test(cc)) return "··";
  return String.fromCodePoint(...cc.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};
