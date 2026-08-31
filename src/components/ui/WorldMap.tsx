import { arcPath, HUB_LINKS, HUBS, landDotPath, project, type Projection } from "@/lib/geo";

const P: Projection = { width: 1000, height: 372 };

interface WorldMapProps {
  /** Dot grid density across 360 deg of longitude. */
  density?: number;
  dotOpacity?: number;
  /** Draw the glowing hub markers + connection arcs. */
  hubs?: boolean;
  /** "slice" fills the box (card backdrops); "meet" letterboxes (hero, split). */
  fit?: "meet" | "slice";
  className?: string;
}

/**
 * Dotted equirectangular world map. Land is rasterised to a single path (see
 * lib/geo) so even the dense hero variant costs one node.
 */
export function WorldMap({ density = 150, dotOpacity = 0.5, hubs = false, fit = "meet", className = "" }: WorldMapProps) {
  const d = landDotPath(P, density, density > 160 ? 0.95 : 1.15);
  const byCode = Object.fromEntries(HUBS.map((h) => [h.code, h]));

  return (
    <svg
      viewBox={`0 0 ${P.width} ${P.height}`}
      className={className}
      preserveAspectRatio={`xMidYMid ${fit}`}
      aria-hidden
    >
      <defs>
        <radialGradient id="wm-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4ADFC0" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#4ADFC0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wm-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2A7FFF" stopOpacity="0.05" />
          <stop offset="50%" stopColor="#5AA6FF" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#2A7FFF" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <path d={d} fill="#2A7FFF" opacity={dotOpacity} />

      {hubs ? (
        <>
          <g fill="none" stroke="url(#wm-arc)" strokeWidth="1.1">
            {HUB_LINKS.map(([a, b]) => {
              const ha = byCode[a];
              const hb = byCode[b];
              if (!ha || !hb) return null;
              return <path key={`${a}-${b}`} d={arcPath(ha, hb, P)} />;
            })}
          </g>
          <g>
            {HUBS.map((h, i) => {
              const { x, y } = project(h.lon, h.lat, P);
              return (
                <g key={h.code}>
                  <circle cx={x} cy={y} r="16" fill="url(#wm-hub)" />
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill="none"
                    stroke="#22E3B0"
                    strokeWidth="1.2"
                    className="origin-center animate-pulseRing"
                    style={{
                      transformOrigin: `${x}px ${y}px`,
                      animationDelay: `${(i * 0.28).toFixed(2)}s`,
                    }}
                  />
                  <circle cx={x} cy={y} r="3.1" fill="#22E3B0" />
                  <circle cx={x} cy={y} r="1.3" fill="#EAFFF8" />
                </g>
              );
            })}
          </g>
        </>
      ) : null}
    </svg>
  );
}
