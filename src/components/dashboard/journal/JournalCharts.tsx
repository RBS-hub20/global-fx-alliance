"use client";

import { AlertTriangle, Clock, LineChart as LineIcon } from "lucide-react";
import { Card, CardHead, money } from "@/components/ui/Primitives";
import type { Bucket, JournalAnalytics, Trade } from "@/lib/journalParser";

/**
 * The visual half of the journal report.
 *
 * Inline SVG rather than a charting library: the dashboard bundle is already
 * 316 kB, lightweight-charts is built for live price series rather than a
 * handful of static summaries, and every chart here is a path or a row of
 * rectangles. Nothing is added to the client for this.
 *
 * Each one reads from computeAnalytics, so the charts and the numbers above them
 * cannot disagree.
 */

const GREEN = "#00ff88";
const RED = "#ff5c5c";
const DIM = "rgba(255,255,255,0.1)";

const pathFrom = (points: [number, number][]) =>
  points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

/* ------------------------------------------------------------ equity curve */

export function EquityCurve({ curve, maxDrawdown }: { curve: number[]; maxDrawdown: number }) {
  if (curve.length < 3) return null;

  const W = 720;
  const H = 200;
  const PAD = 4;

  /*
   * Downsampled to at most 400 points. A 3,550-trade statement would otherwise
   * put 3,550 coordinates in one path for a 720-pixel-wide chart, where four
   * fifths of them land on a pixel that already has a point on it.
   */
  const step = Math.max(1, Math.ceil(curve.length / 400));
  const pts = curve.filter((_, i) => i % step === 0 || i === curve.length - 1);

  const lo = Math.min(0, ...pts);
  const hi = Math.max(0, ...pts);
  const span = hi - lo || 1;
  const x = (i: number) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);

  const line = pts.map((v, i): [number, number] => [x(i), y(v)]);
  const zero = y(0);
  const up = curve[curve.length - 1] >= 0;

  // The underwater curve: how far below the running peak the account was.
  let peak = pts[0];
  const under = pts.map((v, i): [number, number] => {
    peak = Math.max(peak, v);
    return [x(i), peak - v];
  });
  const worst = Math.max(...under.map(([, d]) => d), 1);

  return (
    <Card>
      <CardHead
        title="Equity Curve"
        icon={LineIcon}
        right={<span className="num-mono text-[12px] text-ink-muted">{pts.length} of {curve.length} points</span>}
      />
      <div className="p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative profit and loss over the statement">
          <line x1={PAD} y1={zero} x2={W - PAD} y2={zero} stroke={DIM} strokeWidth="1" strokeDasharray="4 4" />
          <path d={`${pathFrom(line)} L${x(pts.length - 1)} ${zero} L${x(0)} ${zero} Z`}
            fill={up ? "rgba(0,255,136,0.12)" : "rgba(255,92,92,0.12)"} />
          <path d={pathFrom(line)} fill="none" stroke={up ? GREEN : RED} strokeWidth="1.8"
            strokeLinejoin="round" strokeLinecap="round" />
        </svg>

        {/* Drawdown, under the curve it belongs to rather than as its own card. */}
        <p className="mt-4 flex items-baseline justify-between text-[11px] uppercase tracking-[0.12em] text-ink-muted/70">
          <span>Underwater</span>
          <span className="num-mono normal-case tracking-normal text-brand-danger">
            max {money(maxDrawdown)}
          </span>
        </p>
        <svg viewBox={`0 0 ${W} 48`} className="mt-1 w-full" role="img" aria-label="Distance below the running peak">
          <path
            d={`${pathFrom(under.map(([px, d]): [number, number] => [px, (d / worst) * 44]))} L${x(pts.length - 1)} 0 L${x(0)} 0 Z`}
            fill="rgba(255,92,92,0.16)"
          />
          <path d={pathFrom(under.map(([px, d]): [number, number] => [px, (d / worst) * 44]))}
            fill="none" stroke={RED} strokeWidth="1.2" />
        </svg>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------- bars by bucket */

function BucketBars({ title, buckets, note }: { title: string; buckets: Bucket[]; note?: string }) {
  if (!buckets.length) return null;
  const worst = Math.max(...buckets.map((b) => Math.abs(b.net)), 1);

  return (
    <Card>
      <CardHead title={title} />
      <ul className="divide-y divide-white/[0.06]">
        {buckets.map((b) => {
          const width = (Math.abs(b.net) / worst) * 50;
          return (
            <li key={b.key} className="flex items-center gap-3 px-5 py-3">
              <span className="w-[74px] shrink-0 truncate text-[13px] font-semibold text-white">{b.key}</span>
              {/* Signed bar: losses grow left of the centre line, profits right. */}
              <span className="relative h-2 flex-1 rounded-full bg-white/[0.04]">
                <span className="absolute inset-y-0 left-1/2 w-px bg-white/[0.14]" />
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    background: b.net >= 0 ? GREEN : RED,
                    left: b.net >= 0 ? "50%" : `${50 - width}%`,
                    width: `${Math.max(width, 0.6)}%`,
                  }}
                />
              </span>
              <span className="num-mono w-[40px] shrink-0 text-right text-[12px] text-ink-muted">{b.trades}</span>
              <span className="num-mono w-[38px] shrink-0 text-right text-[12.5px] font-semibold text-ink">
                {b.winRate.toFixed(0)}%
              </span>
              <span className={`num-mono w-[72px] shrink-0 text-right text-[12px] ${b.net >= 0 ? "text-brand-green" : "text-brand-danger"}`}>
                {money(b.net, 2)}
              </span>
            </li>
          );
        })}
      </ul>
      <footer className="border-t border-white/[0.08] px-5 py-2.5 text-[11px] text-ink-muted/70">
        {note ?? "Trades, win rate and net per bucket."}
      </footer>
    </Card>
  );
}

/* ----------------------------------------------------- hold time histogram */

const HOLD_BANDS: { label: string; max: number }[] = [
  { label: "<5m", max: 5 },
  { label: "5–15m", max: 15 },
  { label: "15–30m", max: 30 },
  { label: "30–60m", max: 60 },
  { label: "1–4h", max: 240 },
  { label: "4–24h", max: 1440 },
  { label: ">1d", max: Infinity },
];

export function HoldHistogram({ trades }: { trades: Trade[] }) {
  const timed = trades.filter((t) => t.durationMinutes !== null);
  if (!timed.length) return null;

  const bands = HOLD_BANDS.map((band, i) => {
    const lo = i === 0 ? 0 : HOLD_BANDS[i - 1].max;
    const inBand = timed.filter((t) => (t.durationMinutes ?? 0) >= lo && (t.durationMinutes ?? 0) < band.max);
    return {
      label: band.label,
      winners: inBand.filter((t) => t.net > 0).length,
      losers: inBand.filter((t) => t.net <= 0).length,
    };
  });
  const tallest = Math.max(...bands.map((b) => b.winners + b.losers), 1);

  return (
    <Card>
      <CardHead
        title="Hold Time Distribution"
        icon={Clock}
        right={<span className="num-mono text-[12px] text-ink-muted">{timed.length} of {trades.length} timed</span>}
      />
      <div className="p-5">
        <div className="flex h-40 items-end gap-2">
          {bands.map((b) => (
            <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="num-mono text-[10px] text-ink-muted/70">{b.winners + b.losers || ""}</span>
              <div className="flex w-full flex-col justify-end" style={{ height: "100%" }}>
                <span className="w-full rounded-t bg-brand-green/70" style={{ height: `${(b.winners / tallest) * 100}%` }} />
                <span className="w-full bg-brand-danger/70" style={{ height: `${(b.losers / tallest) * 100}%` }} />
              </div>
              <span className="num-mono text-[9px] text-ink-muted/60">{b.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-4 num-mono text-[10px] text-ink-muted/70">
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-brand-green/70" /> winners</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-brand-danger/70" /> losers</span>
          {timed.length < trades.length ? (
            <span>{trades.length - timed.length} trades had no usable timestamps</span>
          ) : null}
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------- the reading */

/**
 * A closed-trade statement with no losses in it.
 *
 * Stated as what it is rather than diagnosed: a report of closed positions
 * cannot show an open one, so an account running a grid or averaging into a
 * drawdown looks flawless here right up until it does not. Naming the pattern
 * is useful; claiming to have detected a specific strategy from a P/L column
 * would not be.
 */
export function RiskNotes({ a, trades }: { a: JournalAnalytics; trades: Trade[] }) {
  const s = a.summary;
  const notes: { tone: "warn" | "info"; head: string; body: string }[] = [];

  if (s.losses === 0 && s.trades >= 20) {
    notes.push({
      tone: "warn",
      head: `No losing trade in ${s.trades} closed positions`,
      body:
        "A statement of closed trades cannot show an open one. If positions are being held through a drawdown — a grid, " +
        "averaging down, or a martingale — the unrealised loss is not in any number on this page, and the equity curve " +
        "above is the balance, not the equity. Check the floating P/L in the terminal before reading this as an edge.",
    });
  }

  if (s.trades >= 500 && Math.abs(s.expectancy) < 1) {
    notes.push({
      tone: "warn",
      head: `${s.trades} trades at ${money(s.expectancy)} expectancy`,
      body:
        "Thousands of trades for a few cents each puts the outcome in the hands of costs and slippage rather than the " +
        "setup. One widened spread or a single unmanaged position can erase a month of it.",
    });
  }

  const costRatio = s.grossWin > 0 ? Math.abs(s.totalCosts) / s.grossWin : 0;
  if (costRatio > 0.2) {
    notes.push({
      tone: "info",
      head: `Costs are ${(costRatio * 100).toFixed(0)}% of gross profit`,
      body: `Commission and swap came to ${money(s.totalCosts)} against ${money(s.grossWin)} of winners. Fewer, larger trades keep more of the same edge.`,
    });
  }

  if (a.patterns.holdsLosersLonger && a.holdTime.avgLoserMin && a.holdTime.avgWinnerMin) {
    notes.push({
      tone: "info",
      head: `Losers held ${(a.holdTime.avgLoserMin / a.holdTime.avgWinnerMin).toFixed(1)}× longer than winners`,
      body: `Winners average ${a.holdTime.avgWinnerMin}m, losers ${a.holdTime.avgLoserMin}m. Cutting fast and hoping slow is the most common shape of a losing month.`,
    });
  }

  const worst = a.patterns.worstPair;
  if (worst && worst.net < 0) {
    notes.push({
      tone: "info",
      head: `${worst.key} cost ${money(Math.abs(worst.net))}`,
      body: `Dropping it would have changed your net by ${money(-worst.net)} across ${worst.trades} trades at a ${worst.winRate.toFixed(0)}% win rate.`,
    });
  }

  const bestSession = a.patterns.bestSession;
  if (bestSession && a.bySession.length > 1) {
    notes.push({
      tone: "info",
      head: `${bestSession.key} is your best session`,
      body: `${bestSession.trades} trades, ${bestSession.winRate.toFixed(0)}% win rate, ${money(bestSession.net)}.`,
    });
  }

  const untimed = trades.filter((t) => t.durationMinutes === null).length;
  if (untimed === trades.length && trades.length > 0) {
    notes.push({
      tone: "warn",
      head: "No hold times could be read",
      body:
        "Neither timestamp column parsed, so hold time, session and hour are read from whichever time was available. " +
        "The column mapping under the upload box shows which columns were matched.",
    });
  }

  if (!notes.length) return null;

  return (
    <Card>
      <CardHead title="What this statement says" icon={AlertTriangle} />
      <ul className="divide-y divide-white/[0.06]">
        {notes.slice(0, 4).map((n) => (
          <li key={n.head} className="px-5 py-4">
            <p className={`text-[13.5px] font-bold ${n.tone === "warn" ? "text-[#FFB020]" : "text-white"}`}>{n.head}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{n.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PairChart({ buckets }: { buckets: Bucket[] }) {
  return <BucketBars title="Net by Instrument" buckets={buckets} note="Sorted by how many trades you took." />;
}

