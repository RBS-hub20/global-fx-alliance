"use client";

import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { Card } from "@/components/ui/Primitives";

/**
 * Live activity across the Alliance — all of it measured.
 *
 * This replaces a request for a ticker of invented joins ("Michael from Canada
 * joined Dubai Chapter — 2m ago"). Everything below is counted from
 * site_events and profiles at request time, which is what makes it worth
 * showing: a number a member can ask you about and you can answer.
 */

interface Pulse {
  measured: boolean;
  visitors7d: number;
  countries7d: number;
  countryCodes: string[];
  liveNow: number;
  approvedMembers: number;
  newestMemberAt: string | null;
}

/** ISO 3166-1 alpha-2 to its flag, which is just two regional indicators. */
const flag = (cc: string): string =>
  /^[a-z]{2}$/i.test(cc)
    ? String.fromCodePoint(...cc.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : "\u{1F3F3}";

const ago = (date: string): string => {
  const days = Math.floor((Date.now() - Date.parse(`${date}T00:00:00Z`)) / 86400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
};

export function AlliancePulse() {
  const [p, setP] = useState<Pulse | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/community/pulse", { cache: "no-store" });
        const j = await res.json();
        if (alive && res.ok && j.ok) setP(j as Pulse);
      } catch {
        /* the page works without it */
      }
    };
    void load();
    // Matches the five-minute live window; faster would re-render the same number.
    const t = setInterval(() => void load(), 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!p || !p.measured || p.visitors7d === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <span className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            {p.liveNow > 0 ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-70" />
            ) : null}
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ background: p.liveNow > 0 ? "#00ff88" : "#404040" }}
            />
          </span>
          <span className="text-[12.5px] text-ink-muted">
            {p.liveNow > 0 ? (
              <>
                <span className="num-mono font-bold text-brand-green">{p.liveNow}</span> reading right now
              </>
            ) : (
              "Quiet right now"
            )}
          </span>
        </span>

        <span className="text-[12.5px] text-ink-muted">
          <span className="num-mono font-bold text-white">{p.visitors7d}</span> people from{" "}
          <span className="num-mono font-bold text-white">{p.countries7d}</span> countries opened the site this week
        </span>

        <span className="text-[12.5px] text-ink-muted">
          <span className="num-mono font-bold text-white">{p.approvedMembers}</span> approved members
          {p.newestMemberAt ? <> · newest joined {ago(p.newestMemberAt)}</> : null}
        </span>

        {p.countryCodes.length ? (
          <span className="flex items-center gap-1.5" title={p.countryCodes.join(", ")}>
            <Globe2 className="h-3.5 w-3.5 text-ink-muted/60" strokeWidth={1.9} />
            <span className="text-[15px] leading-none">
              {p.countryCodes.slice(0, 12).map((c) => flag(c)).join(" ")}
            </span>
            {p.countryCodes.length > 12 ? (
              <span className="text-[11px] text-ink-muted/70">+{p.countryCodes.length - 12}</span>
            ) : null}
          </span>
        ) : null}
      </div>

      <p className="mt-3.5 border-t border-white/[0.08] pt-3 text-[11px] leading-relaxed text-ink-muted/70">
        Counted from this site&apos;s own records, not estimated. &ldquo;People&rdquo; are visitors to the public pages —
        the dashboard is deliberately not tracked — so this is reach, not membership. Nobody is identified: the counts
        come from a daily-rotating hash and a country code.
      </p>
    </Card>
  );
}
