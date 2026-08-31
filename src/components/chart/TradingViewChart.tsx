"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ColorType, CrosshairMode, LineStyle, createChart,
  type IChartApi, type ISeriesApi, type UTCTimestamp,
} from "lightweight-charts";
import type { Drawings } from "@/lib/autoDraw";
import type { Candle } from "@/lib/indicators";

interface Props {
  pair: string;
  ohlc: Candle[];
  drawings: Drawings;
  decimals?: number;
  height?: number;
}

const C = {
  up: "#00D094",
  down: "#FF4D4D",
  support: "#22c55e",
  resistance: "#ef4444",
  trend: "#3b82f6",
  ema20: "#2A7FFF",
  ema50: "#f59e0b",
  ema200: "#eab308",
  grid: "rgba(255,255,255,0.05)",
  text: "#8A93A8",
};

/**
 * TradingView Lightweight Charts with the auto-analysis drawn on top.
 *
 * The chart instance is created once and reused; only series data and price
 * lines are swapped when the pair or candles change, because tearing down and
 * rebuilding the canvas on every update loses the user's zoom and pan.
 *
 * Fair-value gaps are HTML overlays rather than series: v4 has no box primitive,
 * so the boxes are positioned from the chart's own coordinate conversions and
 * repositioned whenever the visible range moves.
 */
export function TradingViewChart({ pair, ohlc, drawings, decimals = 4, height = 460 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const emaRefs = useRef<Record<string, ISeriesApi<"Line"> | null>>({});
  const trendRef = useRef<ISeriesApi<"Line"> | null>(null);
  const priceLinesRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>[]>([]);

  const [boxes, setBoxes] = useState<
    { top: number; height: number; left: number; width: number; type: "bullish" | "bearish" }[]
  >([]);

  // Create the chart once.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChartSafe(el, height, decimals);
    if (!chart) return;
    chartRef.current = chart;

    candleRef.current = chart.addCandlestickSeries({
      upColor: C.up, downColor: C.down,
      borderUpColor: C.up, borderDownColor: C.down,
      wickUpColor: C.up, wickDownColor: C.down,
      priceFormat: { type: "price", precision: decimals, minMove: 1 / 10 ** decimals },
    });

    volRef.current = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "rgba(42,127,255,0.35)",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });

    for (const [key, color] of [["ema20", C.ema20], ["ema50", C.ema50], ["ema200", C.ema200]] as const) {
      emaRefs.current[key] = chart.addLineSeries({
        color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
    }

    trendRef.current = chart.addLineSeries({
      color: C.trend, lineWidth: 2, lineStyle: LineStyle.Solid,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
      queueMicrotask(positionBoxes);
    });
    ro.observe(el);

    const onRange = () => positionBoxes();
    chart.timeScale().subscribeVisibleTimeRangeChange(onRange);

    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRange);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
    };
    // Rebuild only when the instrument's price format changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decimals, height]);

  // Feed data + redraw the auto-analysis.
  useEffect(() => {
    const chart = chartRef.current;
    const candles = candleRef.current;
    if (!chart || !candles || !ohlc.length) return;

    candles.setData(
      ohlc.map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open, high: b.high, low: b.low, close: b.close,
      }))
    );

    volRef.current?.setData(
      ohlc.map((b) => ({
        time: b.time as UTCTimestamp,
        value: b.volume,
        color: b.close >= b.open ? "rgba(0,208,148,0.30)" : "rgba(255,77,77,0.30)",
      }))
    );

    const s = drawings.indicators?.series;
    const line = (series: (number | null)[] | undefined) =>
      (series ?? [])
        .map((v, i) => (v === null ? null : { time: ohlc[i].time as UTCTimestamp, value: v }))
        .filter((v): v is { time: UTCTimestamp; value: number } => v !== null);

    emaRefs.current.ema20?.setData(line(s?.ema20));
    emaRefs.current.ema50?.setData(line(s?.ema50));
    emaRefs.current.ema200?.setData(line(s?.ema200));

    // Trendline: a two-point line series, which is v4's honest way to draw one.
    const tl = drawings.trendline;
    trendRef.current?.setData(
      tl && tl.p1.time !== tl.p2.time
        ? [
            { time: tl.p1.time as UTCTimestamp, value: tl.p1.price },
            { time: tl.p2.time as UTCTimestamp, value: tl.p2.price },
          ]
        : []
    );

    // Support / resistance price lines, rebuilt from scratch each update.
    priceLinesRef.current.forEach((l) => candles.removePriceLine(l));
    priceLinesRef.current = [];

    const addLevel = (price: number, color: string, title: string) => {
      priceLinesRef.current.push(
        candles.createPriceLine({
          price, color, lineWidth: 1, lineStyle: LineStyle.Dashed,
          axisLabelVisible: true, title,
        })
      );
    };

    drawings.supports.forEach((l, i) =>
      addLevel(l.price, C.support, `S${i + 1} ${l.price.toFixed(decimals)} (${l.touches}x)`)
    );
    drawings.resistances.forEach((l, i) =>
      addLevel(l.price, C.resistance, `R${i + 1} ${l.price.toFixed(decimals)} (${l.touches}x)`)
    );

    chart.timeScale().fitContent();
    queueMicrotask(positionBoxes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, ohlc, drawings, decimals]);

  /** Convert each FVG into pixel coordinates for its overlay box. */
  function positionBoxes() {
    const chart = chartRef.current;
    const series = candleRef.current;
    if (!chart || !series) return setBoxes([]);

    const ts = chart.timeScale();
    const next: typeof boxes = [];

    for (const g of drawings.fvgs) {
      const x1 = ts.timeToCoordinate(g.startTime as UTCTimestamp);
      const yTop = series.priceToCoordinate(g.high);
      const yBot = series.priceToCoordinate(g.low);
      if (x1 === null || yTop === null || yBot === null) continue;
      const x2 = ts.timeToCoordinate(g.endTime as UTCTimestamp) ?? x1 + 24;
      next.push({
        left: Math.min(x1, x2),
        width: Math.max(Math.abs(x2 - x1), 10),
        top: Math.min(yTop, yBot),
        height: Math.max(Math.abs(yBot - yTop), 2),
        type: g.type,
      });
    }
    setBoxes(next);
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={wrapRef} className="h-full w-full" />

      {/* Fair-value-gap zones */}
      {boxes.map((b, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-[2px]"
          style={{
            left: b.left, top: b.top, width: b.width, height: b.height,
            background: b.type === "bullish" ? "rgba(0,208,148,0.16)" : "rgba(255,77,77,0.16)",
            border: `1px solid ${b.type === "bullish" ? "rgba(0,208,148,0.45)" : "rgba(255,77,77,0.45)"}`,
          }}
        />
      ))}

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 top-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] num-mono">
        <Key color={C.ema20} label="EMA20" />
        <Key color={C.ema50} label="EMA50" />
        <Key color={C.ema200} label="EMA200" />
        <Key color={C.support} label="Support" />
        <Key color={C.resistance} label="Resistance" />
        <Key color={C.trend} label="Trend" />
      </div>
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-ink-muted/80">
      <span className="inline-block h-[2px] w-3 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Guards against the chart failing to construct in an unusual environment. */
function createChartSafe(el: HTMLDivElement, height: number, decimals: number): IChartApi | null {
  // The whole component is loaded with `ssr: false`, so lightweight-charts never
  // executes on the server; the try/catch only guards against a hostile DOM.
  try {
    return createChart(el, {
      width: el.clientWidth || 600,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: C.text,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        fontSize: 11,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)", scaleMargins: { top: 0.08, bottom: 0.2 } },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.2)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1E4C9E" },
        horzLine: { color: "rgba(255,255,255,0.2)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1E4C9E" },
      },
      localization: { priceFormatter: (p: number) => p.toFixed(decimals) },
      handleScroll: true,
      handleScale: true,
    });
  } catch {
    return null;
  }
}
