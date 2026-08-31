interface SparklineProps {
  points: number[];
  positive: boolean;
  width?: number;
  height?: number;
  className?: string;
}

/** Static, server-renderable micro-chart for the ticker cards. */
export function Sparkline({ points, positive, width = 120, height = 36, className = "" }: SparklineProps) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stroke = positive ? "#00D094" : "#FF4D4D";
  const key = `${positive ? "up" : "dn"}-${points.length}-${Math.round(min * 1e4)}`;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - 2 - ((p - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`sp-${key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${coords.join(" ")} ${width},${height}`} fill={`url(#sp-${key})`} />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
