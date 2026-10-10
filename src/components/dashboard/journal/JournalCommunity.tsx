"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Card, CardHead, money } from "@/components/ui/Primitives";
import type { Summary } from "@/lib/journalPro";

/**
 * How this member compares to everyone who opted in — and nothing more.
 *
 * There is no leaderboard here and no endpoint that returns one. In a community
 * of twelve, "Trader #1 — 65% win — +$5,000" identifies a person to anyone who
 * knows who trades gold, and an opt-in box would only lend that the appearance
 * of consent. One set of averages points at nobody.
 *
 * The averages are withheld entirely below five contributors: with one, the
 * "average" is that person's figures published to everyone; with two, anyone
 * can subtract their own and read the other's.
 */

interface Community {
  sharing: boolean;
  contributors: number;
  minimum: number;
  average: {
    winRate: number | null; profitFactor: number | null; expectancy: number | null;
    avgWin: number | null; avgLoss: number | null; trades: number | null;
  } | null;
  installed?: boolean;
}

export function JournalCommunity({ mine }: { mine: Summary }) {
  const [data, setData] = useState<Community | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/journal/community", { cache: "no-store" }).then((r) => r.json());
      if (j?.ok && j.installed !== false) setData(j as Community);
    } catch { /* the rest of the journal works without it */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!data) return null;

  async function toggle(share: boolean) {
    setBusy(true);
    try {
      await fetch("/api/journal/community", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ share }),
      });
      await load();
    } finally { setBusy(false); }
  }

  const a = data.average;

  // "Better" is not always "higher" — a smaller average loss is the good
  // direction, and colouring it green for being bigger would be backwards.
  const rows: { label: string; mine: number | null; avg: number | null; fmt: (n: number) => string; higherIsBetter: boolean }[] = [
    { label: "Win rate", mine: mine.winRate, avg: a?.winRate ?? null, fmt: (n) => `${n}%`, higherIsBetter: true },
    { label: "Profit factor", mine: mine.profitFactor, avg: a?.profitFactor ?? null, fmt: (n) => n.toFixed(2), higherIsBetter: true },
    { label: "Expectancy", mine: mine.expectancy, avg: a?.expectancy ?? null, fmt: (n) => money(n), higherIsBetter: true },
    { label: "Average win", mine: mine.avgWin, avg: a?.avgWin ?? null, fmt: (n) => money(n), higherIsBetter: true },
    { label: "Average loss", mine: mine.avgLoss, avg: a?.avgLoss ?? null, fmt: (n) => money(n), higherIsBetter: false },
    { label: "Trades logged", mine: mine.trades, avg: a?.trades ?? null, fmt: (n) => String(n), higherIsBetter: true },
  ];

  return (
    <Card>
      <CardHead
        title="You and the community"
        icon={Users}
        right={<span className="num-mono text-[11px] text-ink-muted">{data.contributors} sharing</span>}
      />

      {a ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["", "You", "Average", ""].map((h, i) => (
                  <th key={i} className="px-5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const has = r.mine !== null && r.avg !== null;
                const better = has && (r.higherIsBetter ? r.mine! > r.avg! : r.mine! < r.avg!);
                const same = has && r.mine === r.avg;
                return (
                  <tr key={r.label} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-2.5 text-[12.5px] text-ink">{r.label}</td>
                    <td className="num-mono px-5 py-2.5 text-[13px] font-bold text-white">
                      {r.mine === null ? "—" : r.fmt(r.mine)}
                    </td>
                    <td className="num-mono px-5 py-2.5 text-[13px] text-ink-muted">
                      {r.avg === null ? "—" : r.fmt(r.avg)}
                    </td>
                    <td className={`num-mono px-5 py-2.5 text-[12px] ${same ? "text-ink-muted" : better ? "text-brand-green" : "text-brand-danger"}`}>
                      {!has || same ? "—" : better ? "ahead" : "behind"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-6 text-[13px] leading-relaxed text-ink-muted">
          <span className="font-semibold text-white">
            {Math.max(0, data.minimum - data.contributors)} more member
            {data.minimum - data.contributors === 1 ? "" : "s"} need to opt in before an average can be shown.
          </span>{" "}
          Below {data.minimum} contributors an average is close enough to one person&apos;s own numbers to identify them,
          so none is calculated. {data.contributors} {data.contributors === 1 ? "member is" : "members are"} sharing so far.
        </p>
      )}

      <footer className="border-t border-white/[0.07] px-5 py-3.5">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={data.sharing}
            disabled={busy}
            onChange={(e) => void toggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#00FF88]"
          />
          <span className="text-[12.5px] leading-relaxed text-ink-muted">
            Include my numbers in the community average.{" "}
            <span className="text-ink-muted/70">
              Only the average is ever shown — never your name, never your trades, and never a ranking. You can turn
              this off at any time and your figures drop out of the next calculation.
            </span>
          </span>
        </label>
      </footer>
    </Card>
  );
}
