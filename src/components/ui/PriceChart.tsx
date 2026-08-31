"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

interface PriceChartProps {
  points: number[];
  labels: string[];
  decimals?: number;
  height?: number;
  color?: string;
}

const PAD_R = 54;
const PAD_B = 22;
const PAD_T = 12;

/**
 * Minimal area chart: thin line, gradient fill to transparent, horizontal grid
 * only. Custom SVG rather than a chart library so the grid, crosshair and
 * tick styling match the design system exactly.
 */
export function PriceChart({
  points,
  labels,
  decimals = 4,
  height = 320,
  color = "#2A7FFF",
}: PriceChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { min, max, plotW, plotH, path, area, ticks } = useMemo(() => {
    const lo = Math.min(...points);
    const hi = Math.max(...points);
    const pad = (hi - lo) * 0.12 || 0.001;
    const min = lo - pad;
    const max = hi + pad;
    const plotW = Math.max(width - PAD_R, 10);
    const plotH = height - PAD_B - PAD_T;

    const xy = points.map((p, i) => {
      const x = (i / (points.length - 1)) * plotW;
      const y = PAD_T + plotH - ((p - min) / (max - min)) * plotH;
      return [x, y] as const;
    });

    // Catmull-Rom -> cubic Bezier for a smooth but faithful line.
    let d = `M${xy[0][0].toFixed(2)} ${xy[0][1].toFixed(2)}`;
    for (let i = 0; i < xy.length - 1; i++) {
      const p0 = xy[i - 1] ?? xy[i];
      const p1 = xy[i];
      const p2 = xy[i + 1];
      const p3 = xy[i + 2] ?? p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }

    const area = `${d}L${plotW.toFixed(2)} ${(PAD_T + plotH).toFixed(2)}L0 ${(PAD_T + plotH).toFixed(2)}Z`;
    const ticks = Array.from({ length: 5 }, (_, i) => {
      const v = max - ((max - min) * i) / 4;
      return { v, y: PAD_T + (plotH * i) / 4 };
    });

    return { min, max, plotW, plotH, path: d, area, ticks };
  }, [points, width, height]);

  const onMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const idx = Math.round(ratio * (points.length - 1));
      setHover(Math.max(0, Math.min(points.length - 1, idx)));
    },
    [points.length]
  );

  const hx = hover === null ? 0 : (hover / (points.length - 1)) * plotW;
  const hy =
    hover === null ? 0 : PAD_T + plotH - ((points[hover] - min) / (max - min)) * plotH;

  const xTickEvery = Math.max(1, Math.floor(points.length / 7));

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="pc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal grid + right-hand price scale */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1="0"
              x2={plotW}
              y1={t.y}
              y2={t.y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
            <text
              x={plotW + 10}
              y={t.y + 3.5}
              className="fill-ink-muted text-[10px] num-mono"
            >
              {t.v.toFixed(decimals)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#pc-area)" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />

        {/* x labels */}
        {labels.map((l, i) =>
          i % xTickEvery === 0 && i !== labels.length - 1 ? (
            <text
              key={i}
              x={(i / (points.length - 1)) * plotW}
              y={height - 4}
              textAnchor="middle"
              className="fill-ink-muted text-[10px]"
            >
              {l}
            </text>
          ) : null
        )}

        {hover !== null ? (
          <g>
            <line
              x1={hx}
              x2={hx}
              y1={PAD_T}
              y2={PAD_T + plotH}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={hx} cy={hy} r="9" fill={color} opacity="0.18" />
            <circle cx={hx} cy={hy} r="3.5" fill={color} stroke="#070A12" strokeWidth="1.5" />
          </g>
        ) : null}

        <rect
          x="0"
          y="0"
          width={plotW}
          height={height}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          style={{ cursor: "crosshair" }}
        />
      </svg>

      {hover !== null ? (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0B1120]/95 px-2.5 py-1.5 text-center shadow-glow backdrop-blur-xl"
          style={{ left: Math.min(Math.max(hx, 44), plotW - 44) }}
        >
          <div className="num-mono text-[13px] font-semibold text-white">
            {points[hover].toFixed(decimals)}
          </div>
          <div className="text-[10px] text-ink-muted">{labels[hover]}</div>
        </div>
      ) : null}
    </div>
  );
}
