"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Share2, Zap } from "lucide-react";
import type { Drawings } from "@/lib/autoDraw";
import { compareBias, readBias, type BiasSide } from "@/lib/biasModel";
import { useAuth } from "@/lib/AuthContext";
import { supabaseBrowser } from "@/lib/supabaseClient";

/**
 * The model's read of the chart, the room's read, and how far apart they are.
 *
 * The two cards sit side by side because the comparison is the point. Both
 * numbers come from this component so they cannot be computed against different
 * inputs — the model reads the same `drawings` the chart above is drawn from,
 * and the poll reads the same rows the tally is written to.
 */

const CHOICES: BiasSide[] = ["bullish", "bearish", "neutral"];
const utcDay = () => new Date().toISOString().slice(0, 10);

const SIDE_TEXT: Record<BiasSide, string> = {
  bullish: "text-[#00D094]",
  bearish: "text-[#FF4D4D]",
  neutral: "text-[#8A93A8]",
};
const SIDE_CHIP: Record<BiasSide, string> = {
  bullish: "border-[#00D094]/40 bg-[#00D094]/[0.12] text-[#00D094]",
  bearish: "border-[#FF4D4D]/40 bg-[#FF4D4D]/[0.12] text-[#FF4D4D]",
  neutral: "border-white/20 bg-white/[0.06] text-[#8A93A8]",
};

export function BiasBoard({
  pair, drawings, price, decimals, bars, sourceLabel,
}: {
  pair: string;
  drawings: Drawings;
  price: number;
  decimals: number;
  bars: number | null;
  sourceLabel: string;
}) {
  const { session } = useAuth();
  const supabase = supabaseBrowser();

  const [tally, setTally] = useState<Record<BiasSide, number> | null>(null);
  const [mine, setMine] = useState<BiasSide | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const model = readBias(drawings, price, decimals);

  const load = useCallback(async () => {
    if (!supabase || !session) { setTally(null); return; }
    setErr(null);
    const [t, v] = await Promise.all([
      supabase.rpc("bias_tally", { p_pair: pair }),
      supabase.from("analysis_votes").select("bias").eq("pair", pair).eq("session_day", utcDay()).maybeSingle(),
    ]);
    if (t.error) { setErr(explain(t.error.message)); return; }
    const counts: Record<BiasSide, number> = { bullish: 0, bearish: 0, neutral: 0 };
    for (const row of (t.data ?? []) as { bias: BiasSide; votes: number }[]) counts[row.bias] = Number(row.votes);
    setTally(counts);
    setMine(((v.data as { bias: BiasSide } | null)?.bias) ?? null);
  }, [supabase, session, pair]);

  useEffect(() => { void load(); }, [load]);

  const vote = async (bias: BiasSide) => {
    if (!supabase || !session) return;
    setBusy(true);
    const { error } = await supabase
      .from("analysis_votes")
      .upsert({ user_id: session.user.id, pair, bias }, { onConflict: "user_id,pair,session_day" });
    setBusy(false);
    if (error) { setErr(explain(error.message)); return; }
    await load();
  };

  const votes = tally ? tally.bullish + tally.bearish + tally.neutral : 0;
  const pct = (n: number) => (votes ? Math.round((n / votes) * 100) : 0);
  const roomSide: BiasSide | null = !tally || !votes
    ? null
    : (Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0] as BiasSide);
  const roomShare = roomSide ? pct(tally![roomSide]) : 0;

  const divergence = compareBias(model, { side: roomSide, share: roomShare, votes }, pair);

  const share = async () => {
    setSharing(true);
    try {
      const blob = await renderCard({
        pair,
        model: `${model.side.toUpperCase()} ${model.share}%`,
        modelSide: model.side,
        room: roomSide ? `${roomSide.toUpperCase()} ${roomShare}%` : "NO VOTES YET",
        roomSide,
        headline: divergence.headline,
        price: price.toFixed(decimals),
      });
      if (!blob) return;
      const file = new File([blob], `gfxa-${pair.replace("/", "")}-bias.png`, { type: "image/png" });

      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `GFXA — ${pair}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // A cancelled share throws; nothing to report.
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ------------------------------------------------------ AI BIAS */}
        <section className="overflow-hidden rounded-2xl border border-[#00ff88]/20 bg-[#0a0a0a]">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#00ff88]/15 px-5 py-3 font-mono">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
              <span className="text-[#00ff88]/50">_&gt;</span> AI BIAS — {pair}
            </span>
            <span className="text-[10px] uppercase tracking-[0.1em] text-[#8A93A8]">
              model: GFXA-Structure v2.0
            </span>
            <span className={`ml-auto rounded border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${SIDE_CHIP[model.side]}`}>
              {model.side} {model.thin ? "—" : `${model.share}%`}
            </span>
          </header>

          <div className="px-5 py-4 font-mono text-[12px]">
            {model.factors.length === 0 ? (
              <p className="text-[#8A93A8]">Not enough bars yet to read the structure.</p>
            ) : (
              <ul className="space-y-1.5">
                {model.factors.map((x) => (
                  <li key={x.name} className="flex gap-2 leading-relaxed">
                    <span className={`shrink-0 ${SIDE_TEXT[x.side]}`}>
                      {x.side === "bullish" ? "▲" : x.side === "bearish" ? "▼" : "•"}
                    </span>
                    <span className="text-[#c8d0dc]">{x.detail}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 border-t border-[#00ff88]/10 pt-3 text-[10.5px] leading-relaxed text-[#fbbf24]/80">
              {model.share}% is the share of structural weight on that side — not a probability that price
              moves. Nothing here is backtested against outcomes. Educational only, not financial advice.
              {bars ? ` ${bars} OHLC bars · ${sourceLabel}.` : ` ${sourceLabel}.`}
            </p>
          </div>
        </section>

        {/* ----------------------------------------------- COMMUNITY BIAS */}
        <section className="overflow-hidden rounded-2xl border border-[#00ff88]/20 bg-[#0a0a0a]">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#00ff88]/15 px-5 py-3 font-mono">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
              <span className="text-[#00ff88]/50">_&gt;</span> COMMUNITY BIAS — {pair}
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-[#00ff88]/70">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff88] opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
              </span>
              live poll
            </span>
          </header>

          <div className="space-y-3 px-5 py-4 font-mono text-[12px]">
            {!session ? (
              <p className="text-[#8A93A8]">Sign in to vote.</p>
            ) : tally === null ? (
              <p className="text-[#8A93A8]"><Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />reading the board…</p>
            ) : (
              <>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="bg-[#00D094] transition-all duration-500" style={{ width: `${pct(tally.bullish)}%` }} />
                  <div className="bg-[#FF4D4D] transition-all duration-500" style={{ width: `${pct(tally.bearish)}%` }} />
                  <div className="bg-white/25 transition-all duration-500" style={{ width: `${pct(tally.neutral)}%` }} />
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#00D094]">{pct(tally.bullish)}% bullish</span>
                  <span className="text-[#FF4D4D]">{pct(tally.bearish)}% bearish</span>
                  <span className="text-[#8A93A8]">{pct(tally.neutral)}% neutral</span>
                </div>

                <div className="flex gap-2">
                  {CHOICES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={busy}
                      onClick={() => void vote(c)}
                      aria-pressed={mine === c}
                      className={`flex-1 rounded border px-2 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-all disabled:opacity-40 ${
                        mine === c ? SIDE_CHIP[c] : "border-white/[0.1] text-[#8A93A8] hover:text-white"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <p className="text-[10.5px] leading-relaxed text-[#8A93A8]">
                  {votes === 0
                    ? "No votes yet today — yours would be the first."
                    : `${votes} member${votes === 1 ? "" : "s"} voted today.`}
                  {mine ? ` You voted ${mine} — tap another to change it.` : ""} Resets 00:00 UTC.
                </p>
              </>
            )}
            {err ? <p className="text-[11px] text-[#FF4D4D]">{err}</p> : null}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------ DIVERGENCE */}
      <section
        className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-5 py-4 font-mono ${
          divergence.state === "diverging"
            ? "border-[#fbbf24]/40 bg-[#fbbf24]/[0.07]"
            : divergence.state === "aligned"
              ? "border-[#00ff88]/30 bg-[#00ff88]/[0.05]"
              : "border-white/[0.1] bg-white/[0.02]"
        }`}
      >
        <span className={divergence.state === "diverging" ? "text-[#fbbf24]" : "text-[#00ff88]"}>
          <Zap className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[12px] font-bold uppercase tracking-[0.1em] ${
            divergence.state === "diverging" ? "text-[#fbbf24]" : divergence.state === "aligned" ? "text-[#00ff88]" : "text-[#8A93A8]"
          }`}>
            {divergence.headline}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#c8d0dc]">{divergence.detail}</p>
        </div>

        <button
          type="button"
          onClick={() => void share()}
          disabled={sharing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded border border-white/[0.15] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8A93A8] transition-colors hover:text-white disabled:opacity-40"
        >
          {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
          Share
        </button>
      </section>
    </div>
  );
}

/* --------------------------------------------------------------- share card */

/**
 * Draws the shareable PNG on a canvas — no dependency, and nothing leaves the
 * browser. Returns null when canvas is unavailable rather than throwing.
 */
async function renderCard(d: {
  pair: string; model: string; modelSide: BiasSide; room: string; roomSide: BiasSide | null;
  headline: string; price: string;
}): Promise<Blob | null> {
  const W = 1200, H = 630;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;

  const colour = (s: BiasSide | null) => (s === "bullish" ? "#00D094" : s === "bearish" ? "#FF4D4D" : "#8A93A8");
  const mono = (px: number, weight = "700") => `${weight} ${px}px ui-monospace, SFMono-Regular, Menlo, monospace`;

  g.fillStyle = "#0a0a0a";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(0,255,136,0.25)";
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, W - 3, H - 3);

  g.fillStyle = "#00ff88";
  g.font = mono(26);
  g.fillText("_> GFXA TERMINAL v2.0", 64, 86);

  g.fillStyle = "#ffffff";
  g.font = mono(76);
  g.fillText(d.pair, 64, 190);
  g.fillStyle = "#8A93A8";
  g.font = mono(40, "500");
  g.fillText(d.price, 64 + g.measureText(d.pair).width + 320, 190);

  g.strokeStyle = "rgba(0,255,136,0.15)";
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(64, 232); g.lineTo(W - 64, 232); g.stroke();

  g.fillStyle = "#8A93A8";
  g.font = mono(22, "500");
  g.fillText("MODEL — GFXA-STRUCTURE", 64, 300);
  g.fillText("COMMUNITY", 640, 300);

  g.fillStyle = colour(d.modelSide);
  g.font = mono(54);
  g.fillText(d.model, 64, 366);
  g.fillStyle = colour(d.roomSide);
  g.fillText(d.room, 640, 366);

  g.fillStyle = "#fbbf24";
  g.font = mono(30);
  wrap(g, d.headline, 64, 460, W - 128, 40);

  g.fillStyle = "rgba(251,191,36,0.75)";
  g.font = mono(18, "500");
  g.fillText("Educational only — not financial advice. Percentages are structural weight, not probability.", 64, H - 56);
  g.fillStyle = "#00ff88";
  g.font = mono(18);
  g.fillText("globalfxalliance.io", W - 64 - g.measureText("globalfxalliance.io").width, H - 56);

  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = "";
  let ty = y;
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > max && line) {
      g.fillText(line, x, ty);
      line = word;
      ty += lh;
    } else {
      line = test;
    }
  }
  if (line) g.fillText(line, x, ty);
}

function explain(message: string): string {
  if (/Could not find the function|does not exist/i.test(message)) {
    return "Community tables not installed — run supabase/analysis_community.sql.";
  }
  if (/row-level security|permission denied/i.test(message)) {
    return "Blocked by row-level security — run supabase/analysis_community.sql.";
  }
  return message;
}
