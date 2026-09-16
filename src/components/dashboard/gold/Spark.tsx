/** Minimal sparkline. The colour follows the sign the caller passes, not the line's own slope. */
export function Spark({ values, up, width = 84, height = 26 }: { values: number[]; up: boolean; width?: number; height?: number }) {
  if (values.length < 2) return <span className="inline-block" style={{ width, height }} />;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(2 + (1 - (v - lo) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "#00ff88" : "#ff4d4d"} strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
