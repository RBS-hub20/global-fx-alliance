"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera, Check, Copy, Info, Loader2, RotateCcw, Share2, Upload, X,
} from "lucide-react";
import { Card, CardHead, Field, PanelHeader, Pills, Select, Skeleton, Toast } from "@/components/ui/Primitives";
import { DEFAULT_PROFILE, planToText, type Style, type TradePlan, type TradeProfile } from "@/lib/chartSnap";
import { PAIRS } from "@/lib/market";
import { TIMEFRAMES } from "@/lib/timeframes";
import { getBestWorst, getPairStats } from "@/lib/journalStore";
import { buildJournalAggregate } from "@/lib/journalAggregate";
import { getCurrentSessionInfo, humanMinutes } from "@/lib/sessionTime";
import { addSharedPost } from "@/lib/communityPosts";
import { readStore, writeStore } from "@/lib/storage";
import { EVENTS, trackEvent } from "@/lib/analytics";
import { tabHref } from "@/lib/tabs";

const PROFILE_KEY = "gfxa-chart-snap-profile";
const STEPS = [
  "Reading your selection",
  "Fetching live candles",
  "Scanning patterns and levels",
  "Checking your journal",
  "Building the worked example",
];

interface Analysis {
  ok: boolean;
  symbol: string;
  timeframe: string;
  interval: string;
  decimals: number;
  imageAnalysed: boolean;
  imageNote: string;
  market: {
    price: number; bars: number; isReal: boolean; source: string; symbolUsed: string | null;
    cached?: boolean; ageSeconds?: number | null; stale?: boolean;
    provider?: string; aggregated?: boolean;
  };
  minTouchesForHigh: number;
  anchor: "live" | "screenshot" | "modeled";
  planAvailable: boolean;
  planUnavailableReason: string | null;
  validation: {
    compared: boolean; screenshotPrice?: number; realPrice?: number;
    diff?: number; diffPct?: number; isStale?: boolean; badge?: string; note?: string;
  };
  structure: { supports: { price: number; touches: number }[]; resistances: { price: number; touches: number }[] };
  patterns: { type: string; direction: string; confidence: string; price: number; description: string }[];
  indicators: { rsi: number | null; rsiLabel: string; atrPct: number | null; macd: string | null } | null;
  read: {
    state: string; label: string; bias: "bullish" | "bearish" | "neutral";
    confidence: "high" | "medium" | "low";
    level: { price: number; touches: number; type: "support" | "resistance" } | null;
    distance: number | null; distanceAtr: number | null;
    rsi: number | null; rsiLabel: string;
    pattern: { type: string; direction: string; confidence: string } | null;
    observations: string[]; cautions: string[];
  } | null;
  tradePlan: TradePlan | null;
  sources: string[];
  disclaimer: string;
}

export function ChartSnapPanel() {
  const [profile, setProfile] = useState<TradeProfile>(DEFAULT_PROFILE);
  const [symbol, setSymbol] = useState("XAU/USD");
  const [timeframe, setTimeframe] = useState("1H");
  const [screenshotPrice, setScreenshotPrice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explainer, setExplainer] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfile(readStore<TradeProfile>(PROFILE_KEY, DEFAULT_PROFILE));
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2000); };

  const takeFile = (f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("That file isn't an image. PNG or JPG from any charting platform works.");
      return;
    }
    setError(null);
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    // Filenames from TradingView and MT5 usually carry the instrument.
    const guess = PAIRS.find((p) => f.name.toUpperCase().replace(/[^A-Z]/g, "").includes(p.symbol.replace("/", "")));
    if (guess) setSymbol(guess.symbol);
  };

  const analyse = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStep(0);
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      fd.append("symbol", symbol);
      fd.append("timeframe", timeframe);
      if (screenshotPrice.trim()) fd.append("screenshotPrice", screenshotPrice.trim());
      if (profile.useProfile) {
        fd.append("mode", profile.mode);
        fd.append("balance", String(profile.balance));
        fd.append("riskPct", String(profile.riskPct));
        fd.append("fixedRisk", String(profile.fixedRisk));
        fd.append("style", profile.style);
      }
      const res = await fetch("/api/chart-snap/analyze", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.message ?? "Analysis failed. Try again in a moment.");
        return;
      }
      const json = (await res.json()) as Analysis;
      setResult(json);
      trackEvent(EVENTS.chartSnap, { pair: symbol, timeframe });

      // The computed read is already on screen; the prose arrives after. Failure
      // here is silent — the analysis stands on its own without it.
      setExplainer(null);
      setExplaining(true);
      fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `/snap ${symbol} ${timeframe}`,
          journal: buildJournalAggregate(),
          pair: symbol,
          timeframe,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j?.available && j.answer) setExplainer(j.answer as string); })
        .catch(() => {})
        .finally(() => setExplaining(false));
    } catch {
      setError("Could not reach the analyzer. Check your connection and retry.");
    } finally {
      clearInterval(ticker);
      setBusy(false);
    }
  }, [file, symbol, timeframe, screenshotPrice, profile]);

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setResult(null); setError(null); setScreenshotPrice("");
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        title="Chart Snap Analyzer"
        action={
          result ? (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11.5px] text-ink-muted transition-all duration-200 hover:border-brand-blue/40 hover:text-white">
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.9} />
              New analysis
            </button>
          ) : null
        }
      />

      {/* How it works — stated before anything else */}
      <div className="flex items-start gap-3 rounded-xl border border-brand-blue/25 bg-brand-blue/[0.05] px-4 py-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" strokeWidth={2} />
        <p className="text-[12.5px] leading-relaxed text-ink">
          <span className="font-semibold text-white">This does not read your image.</span> You name the
          instrument and timeframe — which you can see on your own chart — and the plan is built from
          live candles, the real pattern scanner and your own statement. Nothing invented from pixels,
          and your screenshot is never stored or uploaded anywhere.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
        {/* -------------------------------------------------------- upload */}
        <div className="space-y-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) takeFile(f); }}
            className={`relative overflow-hidden rounded-2xl border border-dashed transition-all duration-200 ${
              dragging ? "border-brand-blue/60 bg-brand-blue/[0.06]" : "border-white/[0.12] bg-white/[0.02]"
            }`}
          >
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Your uploaded chart" className="max-h-[420px] w-full object-contain" />
                <button
                  type="button"
                  onClick={reset}
                  aria-label="Remove image"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-ink transition-colors hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                {result ? (
                  <div className="absolute bottom-3 left-3 rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-[11px] text-ink-muted backdrop-blur">
                    Reference image · levels below come from live data
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="p-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-brand-blue/25 bg-brand-blue/10 text-brand-blue">
                  <Camera className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <p className="mt-4 text-[14px] font-semibold text-white">Screenshot your chart</p>
                <p className="mx-auto mt-2 max-w-[48ch] text-[12.5px] leading-relaxed text-ink-muted">
                  Drop a screenshot from TradingView, MT4/MT5 or any platform — Vantage, VT Markets,
                  PUPRIME. It is shown for your reference while the plan is built from live data.
                </p>
                <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary mt-5 !px-4 !py-2.5 text-[12.5px]">
                  <Upload className="h-4 w-4" strokeWidth={2.2} />
                  Choose image
                </button>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) takeFile(f); e.target.value = ""; }}
            />
          </div>

          <Card>
            <CardHead title="What am I looking at?" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
              <Select label="Instrument" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {PAIRS.map((p) => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
              </Select>
              <Select label="Timeframe" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                {TIMEFRAMES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
              <Field
                label="Price on screenshot"
                placeholder="e.g. 4304.02"
                inputMode="decimal"
                value={screenshotPrice}
                onChange={(e) => setScreenshotPrice(e.target.value)}
              />
            </div>
            <p className="px-5 pb-5 text-[11.5px] leading-relaxed text-ink-muted/80">
              Worth filling in. It lets the analyzer check whether your chart is still current, and
              if the live feed is rate-limited it becomes the anchor for the plan — without it, no
              plan is generated rather than one built on a price that may have drifted.
            </p>
          </Card>

          <button type="button" onClick={analyse} disabled={busy} className="btn-primary w-full !py-3 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" strokeWidth={2.2} />}
            {busy ? "Analyzing…" : "Analyze chart"}
          </button>

          {busy ? (
            <Card className="p-5">
              <ul className="space-y-2.5">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-[12.5px]">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      i < step ? "border-brand-green/50 bg-brand-green/15 text-brand-green" :
                      i === step ? "border-brand-blue/50 bg-brand-blue/15 text-brand-blue" :
                      "border-white/[0.1] text-transparent"
                    }`}>
                      {i < step ? <Check className="h-3 w-3" strokeWidth={3} /> : i === step ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    </span>
                    <span className={i <= step ? "text-ink" : "text-ink-muted/50"}>{s}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {result?.read ? (
            <StructureCard a={result} explainer={explainer} explaining={explaining} />
          ) : null}

          {error ? (
            <p role="alert" className="rounded-lg border border-brand-danger/30 bg-brand-danger/[0.08] px-4 py-3 text-[12.5px] text-brand-danger">
              {error}
            </p>
          ) : null}
        </div>

        {/* ------------------------------------------------------- profile */}
        <div className="space-y-5">
          <ProfileCard profile={profile} setProfile={setProfile} onSave={() => { writeStore(PROFILE_KEY, profile); flash("Profile saved"); }} />
          {result ? <PlanCard a={result} onToast={flash} /> : null}
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

const BIAS_TONE: Record<string, string> = {
  bullish: "border-brand-green/40 bg-brand-green/[0.1] text-brand-green",
  bearish: "border-brand-danger/40 bg-brand-danger/[0.1] text-brand-danger",
  neutral: "border-white/[0.14] bg-white/[0.05] text-ink",
};

/**
 * What the structure is doing, and why it might be wrong.
 *
 * The badge reports a state and a bias, never an order type: this panel reads
 * charts, it does not tell anyone to transact. The written explainer lands a
 * moment after the numbers, so nothing waits on a model call.
 */
function StructureCard({
  a, explainer, explaining,
}: {
  a: Analysis;
  explainer: string | null;
  explaining: boolean;
}) {
  const r = a.read!;
  const f = (v: number) => v.toFixed(a.decimals);

  return (
    <Card>
      <CardHead
        title="What the structure is doing"
        right={
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-ink-muted">
            {r.confidence} confidence
          </span>
        }
      />
      <div className="space-y-4 p-5">
        <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 ${BIAS_TONE[r.bias] ?? BIAS_TONE.neutral}`}>
          <span className="text-[13px] font-semibold">{r.label}</span>
          {r.level ? (
            <span className="num-mono text-[12px] opacity-90">
              {f(r.level.price)} · {r.level.touches} {r.level.touches === 1 ? "touch" : "touches"}
              {r.distanceAtr !== null ? ` · ${r.distanceAtr}×ATR away` : ""}
            </span>
          ) : null}
        </div>

        <ul className="space-y-2">
          {r.observations.map((o, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-muted">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-blue" aria-hidden />
              <span>{o}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-[#fbbf24]/25 bg-[#fbbf24]/[0.05] p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#fbbf24]">
            Bakit pwedeng mali
          </p>
          <ul className="space-y-1.5">
            {r.cautions.map((c, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-ink-muted">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#fbbf24]" aria-hidden />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {explaining ? (
          <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>
        ) : explainer ? (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-brand-blue">
              Bakit ganito ang basa
            </p>
            <div className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink-muted">{explainer}</div>
          </div>
        ) : null}

        <p className="text-[11px] leading-relaxed text-ink-muted/70">
          An observation of structure, not a recommendation. Any numbers below are an illustration of how
          risk is measured, sized on your profile&apos;s example balance.
        </p>
      </div>
    </Card>
  );
}

function ProfileCard({
  profile, setProfile, onSave,
}: { profile: TradeProfile; setProfile: (p: TradeProfile) => void; onSave: () => void }) {
  const set = <K extends keyof TradeProfile>(k: K, v: TradeProfile[K]) => setProfile({ ...profile, [k]: v });
  return (
    <Card>
      <CardHead
        title="Trade Profile"
        right={
          <button
            type="button"
            onClick={() => set("useProfile", !profile.useProfile)}
            role="switch"
            aria-checked={profile.useProfile}
            aria-label="Use trade profile in analysis"
            className={`relative h-5 w-9 rounded-full border transition-all duration-200 ${
              profile.useProfile ? "border-brand-blue/50 bg-brand-blue/70" : "border-white/[0.1] bg-white/[0.06]"
            }`}
          >
            <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white transition-all duration-200 ${profile.useProfile ? "left-[19px]" : "left-[3px]"}`} />
          </button>
        }
      />
      <div className="space-y-4 p-5">
        <Pills
          options={[{ value: "percent", label: "% of account" }, { value: "fixed", label: "Fixed $ risk" }]}
          value={profile.mode}
          onChange={(v) => set("mode", v)}
          size="sm"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account balance" type="number" inputMode="decimal" suffix="USD" value={profile.balance} onChange={(e) => set("balance", Number(e.target.value) || 0)} />
          {profile.mode === "percent" ? (
            <Field label="Risk per trade" type="number" inputMode="decimal" step="0.1" suffix="%" value={profile.riskPct} onChange={(e) => set("riskPct", Number(e.target.value) || 0)} />
          ) : (
            <Field label="Risk per trade" type="number" inputMode="decimal" suffix="USD" value={profile.fixedRisk} onChange={(e) => set("fixedRisk", Number(e.target.value) || 0)} />
          )}
        </div>
        <Select label="Style" value={profile.style} onChange={(e) => set("style", e.target.value as Style)}>
          {["Conservative", "Balanced", "Aggressive"].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <p className="text-[11.5px] leading-relaxed text-ink-muted/80">
          Style changes where the invalidation sits and how far objectives project — never how much
          is risked. That stays whatever you set above.
        </p>
        <button type="button" onClick={onSave} className="btn-ghost w-full !py-2.5 text-[12.5px]">
          Save profile
        </button>
      </div>
    </Card>
  );
}

function PlanCard({ a, onToast }: { a: Analysis; onToast: (m: string) => void }) {
  const p = a.tradePlan;
  const f = (v: number) => v.toFixed(a.decimals);
  const top = a.patterns[0] ?? null;

  const journal = getBestWorst();
  const pairStat = getPairStats(a.symbol);
  const session = getCurrentSessionInfo(
    new Date(),
    journal.bySession.map((s) => ({ key: s.key, winRate: s.winRate, trades: s.trades }))
  );
  const hourKey = String(session.dubaiHour).padStart(2, "0");
  const atWorstHour = journal.worstHourDubai?.key === hourKey;

  const share = () => {
    if (!p) return;
    addSharedPost(
      `${a.symbol} ${a.timeframe} — ${top ? `${top.type} (${top.confidence})` : "structure review"}. Reference entry ${f(p.entry)}, invalidation ${f(p.stopLoss)}, objectives ${f(p.target1)} / ${f(p.target2)}. Educational example, not a signal.`,
      `Chart Snap · ${a.market.isReal ? `real ${a.market.symbolUsed}` : "modelled"}`
    );
    onToast("Shared to your community feed");
  };

  return (
    <Card className="border-brand-blue/25">
      <CardHead
        title="Trade Plan"
        right={
          <span className="rounded-full bg-[#fbbf24]/[0.13] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#fbbf24]">
            Educational example
          </span>
        }
      />
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-bold tracking-tight text-white">{a.symbol}</span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">
            {a.timeframe} · {a.interval}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] ${
            a.anchor === "live"
              ? "bg-brand-green/[0.13] text-brand-green"
              : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
          }`}>
            {a.anchor === "live"
              ? `Real · ${a.market.provider}${a.market.symbolUsed && a.market.symbolUsed !== a.symbol ? ` ${a.market.symbolUsed}` : ""} ${a.market.price}${a.market.stale ? ` · cached ${a.market.ageSeconds}s` : ""}`
              : a.anchor === "screenshot"
                ? `Your screenshot · ${a.market.price}`
                : "Modelled"}
          </span>
        </div>

        <p className="text-[11.5px] leading-relaxed text-ink-muted">
          {a.market.bars} {a.timeframe} candles
          {a.market.aggregated ? " (2H/4H rolled up from 1H — Yahoo has no native interval)" : ""}
          {a.anchor === "live" ? ` from ${a.market.provider}` : ""}. Levels and patterns below are
          derived from these candles, at this timeframe.
          {["5M", "15M"].includes(a.timeframe)
            ? ` On ${a.timeframe} a level needs ${a.minTouchesForHigh} touches before a pattern on it reads high — short candles are noisy.`
            : ""}
        </p>

        {/* screenshot vs live */}
        {a.validation.compared ? (
          <div className={`rounded-lg border px-3.5 py-3 text-[12.5px] ${
            a.validation.isStale ? "border-[#fbbf24]/35 bg-[#fbbf24]/[0.07] text-[#fbbf24]" : "border-brand-green/30 bg-brand-green/[0.06] text-brand-green"
          }`}>
            <span className="font-bold uppercase tracking-[0.1em]">{a.validation.badge}</span>
            <span className="ml-2 text-ink-muted">
              screenshot {a.validation.screenshotPrice} vs live {a.validation.realPrice} ({a.validation.diffPct}%)
            </span>
          </div>
        ) : null}

        {!a.planAvailable || !p ? (
          <div className="rounded-lg border border-[#fbbf24]/35 bg-[#fbbf24]/[0.07] px-3.5 py-3.5 text-[12.5px] leading-relaxed text-[#fbbf24]">
            <span className="block font-bold uppercase tracking-[0.1em]">No plan generated</span>
            <span className="mt-1.5 block text-ink">{a.planUnavailableReason}</span>
          </div>
        ) : null}

        {top ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Structure found now</p>
            <p className="mt-1.5 text-[13.5px] text-white">
              {top.type} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase ${top.confidence === "high" ? "bg-brand-green/[0.13] text-brand-green" : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"}`}>{top.confidence}</span>
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{top.description}</p>
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-muted">
            No pattern is flagged on {a.symbol} right now — the plan below is a level exercise rather
            than a setup.
          </p>
        )}

        {p ? (
        <dl className="divide-y divide-white/[0.06] border-y border-white/[0.08]">
          {[
            { k: "Bias", v: p.direction, tone: p.direction === "bullish" ? "text-brand-green" : p.direction === "bearish" ? "text-brand-danger" : "text-ink" },
            { k: "Reference entry", v: f(p.entry), tone: "text-white" },
            { k: "Invalidation", v: `${f(p.stopLoss)} · ${p.stopPips}p`, tone: "text-brand-danger" },
            { k: `Target 1 (${p.rr1})`, v: f(p.target1), tone: "text-brand-green" },
            { k: `Target 2 (${p.rr2})`, v: f(p.target2), tone: "text-brand-green" },
            { k: "Size", v: `${p.lots} lots · $${p.riskUsd} (${p.riskPctOfBalance}%)`, tone: "text-brand-blue" },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <dt className="text-ink-muted">{r.k}</dt>
              <dd className={`num-mono font-semibold ${r.tone}`}>{r.v}</dd>
            </div>
          ))}
        </dl>
        ) : null}

        {p ? (
          <p className="text-[12px] leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink">Where the stop came from:</span> {p.stopBasis}.
            Style {p.style} — {p.styleNote}.
          </p>
        ) : null}

        {/* journal + session, merged client-side */}
        <div className="space-y-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Against your record{journal.isReal ? "" : " (sample)"}
          </p>
          <p className="text-[12.5px] leading-relaxed text-ink">
            {pairStat
              ? `You are ${pairStat.winRate.toFixed(0)}% on ${a.symbol} across ${pairStat.trades} trades (${pairStat.net >= 0 ? "+" : "-"}$${Math.abs(pairStat.net).toFixed(2)}).`
              : `No ${a.symbol} trades in the loaded history.`}
          </p>
          {atWorstHour && journal.worstHourDubai ? (
            <p className="text-[12.5px] leading-relaxed text-brand-danger">
              It is {hourKey}:00 Dubai — your worst hour, {journal.worstHourDubai.winRate.toFixed(0)}% across {journal.worstHourDubai.trades} trades.
            </p>
          ) : journal.bestHourDubai ? (
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              Your strongest hour is {journal.bestHourDubai.key}:00 Dubai; it is now {hourKey}:00.
            </p>
          ) : null}
          {journal.holdsLosersLonger && journal.avgWinHold ? (
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              You hold losers {((journal.avgLossHold ?? 0) / Math.max(journal.avgWinHold, 1)).toFixed(1)}× longer than winners — Target 1 may suit you better than Target 2.
            </p>
          ) : null}
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            Session: {session.active.length ? `${session.active.map((s) => s.name).join(", ")} open` : "between sessions"}
            {session.next ? `, ${session.next.name} in ${humanMinutes(session.next.minutesToOpen)}` : ""}.
          </p>
        </div>

        <p className="text-[11px] leading-relaxed text-ink-muted/70">
          Sources: {a.sources.join(" · ")} · {journal.isReal ? `your journal (${journal.count})` : `sample journal (${journal.count})`}
        </p>

        <div className="flex flex-wrap gap-2">
          {p ? (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(planToText(a.symbol, a.timeframe, p, a.decimals));
                onToast("Plan copied");
              } catch { onToast("Copy failed — select the text manually"); }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium text-ink transition-all duration-200 hover:border-brand-blue/40 hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
            Copy plan
          </button>
          ) : null}
          <Link href={tabHref("market-analysis", a.symbol)} className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium text-ink transition-all duration-200 hover:border-brand-blue/40 hover:text-white">
            View on chart
          </Link>
          <Link href={tabHref("journal-analytics")} className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium text-ink transition-all duration-200 hover:border-brand-blue/40 hover:text-white">
            Check journal
          </Link>
          {p ? (
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-medium text-ink transition-all duration-200 hover:border-brand-blue/40 hover:text-white"
          >
            <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
            Share to community
          </button>
          ) : null}
        </div>

        <p className="border-t border-white/[0.08] pt-4 text-[11px] leading-relaxed text-ink-muted/70">
          {a.disclaimer} {a.imageNote}
        </p>
      </div>
    </Card>
  );
}
