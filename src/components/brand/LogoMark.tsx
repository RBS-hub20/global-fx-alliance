import type { SVGProps } from "react";

/**
 * Vector rebuild of the GLOBAL FX ALLIANCE emblem: a navy / electric-blue globe
 * with the Americas facing the viewer, a silver-to-blue orbital ring, six rising
 * candlesticks (2 silver base, 4 green) and the twin stars.
 *
 * The raster /logo.png carries a baked-in dark backdrop, so this mark is used
 * anywhere the logo sits on glass or needs to scale - navbar, sidebar, favicon,
 * membership card, verification badges.
 */

/** Coastlines orthographically projected from src/lib/geo.ts, centred on 72W/14N. */
const LANDMASS =
  "M21.9 16.3L21.1 16.7L20.3 17.1L20.0 17.4L19.7 17.8L19.9 17.8L20.1 17.8L20.3 17.9L20.5 18.0L20.8 18.0L20.7 18.3L20.7 18.6L20.4 19.1L20.3 19.6L20.0 20.2L19.8 20.9L19.4 21.6L18.9 22.3L18.6 23.3L18.3 24.3L18.4 24.9L18.5 25.5L18.9 26.2L19.0 27.2L19.2 28.1L19.5 28.7L19.9 29.2L20.5 29.8L21.2 30.4L21.9 31.0L22.7 31.1L23.6 30.3L22.5 30.2L22.4 29.2L22.3 28.3L22.8 27.8L23.3 27.2L23.9 27.3L24.5 27.3L25.6 27.1L25.9 27.8L26.2 28.6L26.4 27.7L26.7 26.8L27.3 26.3L28.0 25.7L28.5 24.6L29.0 24.2L29.5 23.8L29.9 23.4L30.3 23.0L30.9 22.7L31.5 22.4L31.9 22.0L32.3 21.6L31.8 20.7L31.0 20.2L30.3 19.8L29.7 19.6L29.2 19.4L28.6 19.2L28.1 19.0L27.7 18.6L27.4 18.3L27.1 18.0L26.8 17.7L26.7 17.4L26.3 17.5L25.8 17.5L25.4 17.6L25.2 17.4L25.1 17.3L24.9 17.1L24.7 17.0L24.4 17.0L24.2 16.9L23.9 16.9L23.5 16.9L23.4 16.7L23.3 16.6L23.3 16.5L23.3 16.3L23.3 16.2L23.3 16.1L22.8 16.2L22.4 16.2ZM23.3 30.8L24.4 30.9L25.0 32.0L25.7 33.1L26.4 33.3L27.2 33.5L27.5 33.8L26.6 33.8L25.7 33.8L25.1 33.0L24.6 32.2L23.9 31.8L23.2 31.4ZM33.0 19.2L32.5 18.9L32.0 18.7L31.5 18.3L31.1 17.9L30.7 17.6L30.4 17.3L30.0 16.9L29.7 16.5L29.8 16.3L29.7 16.0L29.9 15.9L29.9 15.7L30.0 15.6L30.1 15.6L30.2 15.6L30.3 15.6L30.4 15.5L30.9 15.7L31.5 15.9L32.1 16.0L32.6 16.3L33.1 16.7L33.4 17.0L33.6 17.4L33.5 17.6L33.3 17.9L33.1 18.1L33.2 18.5L33.2 18.9ZM25.4 29.5L26.5 29.7L27.6 29.9L28.6 30.2L29.6 30.5L28.4 30.2L27.9 29.7L27.3 29.2L26.5 29.2L25.7 29.2ZM26.3 36.8L26.6 37.9L27.0 38.8L27.5 39.7L28.4 40.5L29.3 41.3L29.4 42.0L29.6 42.8L29.4 43.5L29.2 44.2L29.0 44.8L28.8 45.4L28.7 46.0L28.5 46.5L28.5 47.1L28.4 47.6L28.9 48.0L29.4 48.3L30.0 48.3L30.1 47.9L30.2 47.4L30.8 46.8L31.3 46.1L31.9 45.6L32.5 45.1L33.1 44.9L33.8 44.6L34.6 43.9L35.3 43.2L36.1 42.6L36.9 42.0L37.7 41.4L38.0 40.4L38.3 39.3L38.9 38.5L39.4 37.7L39.1 37.2L38.8 36.7L37.9 36.4L36.9 36.1L36.3 36.0L35.6 35.9L35.0 34.8L34.1 34.3L33.2 33.7L32.0 33.2L30.8 33.0L29.6 32.9L28.8 33.1L28.1 33.2L27.2 33.8L27.0 34.7L26.9 35.6ZM41.1 20.1L42.0 20.9L42.4 21.1L42.8 21.7L42.7 21.9L42.1 21.2L41.5 20.6ZM39.3 20.1L38.6 19.5L38.2 19.1L37.5 18.4L37.6 18.3L38.2 18.7L38.7 19.1L39.2 19.2L39.5 19.5L39.5 19.9Z";

/**
 * The emblem's gradients live in one document-level sprite rather than being
 * re-declared per instance: a module-scoped counter desynchronises between the
 * server and client render and trips React's hydration check, and duplicating
 * identical <defs> for every logo on the page is wasted markup either way.
 * <LogoDefs /> is mounted once in the root layout.
 */
const U = {
  globe: "url(#gfxa-globe)",
  sheen: "url(#gfxa-sheen)",
  ringBack: "url(#gfxa-ring-back)",
  ringFront: "url(#gfxa-ring-front)",
  green: "url(#gfxa-green)",
  silver: "url(#gfxa-silver)",
  star: "url(#gfxa-star)",
  clip: "url(#gfxa-globe-clip)",
};

export function LogoDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute" focusable="false">
      <defs>
        <radialGradient id="gfxa-globe" cx="34%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#3B8FFF" />
          <stop offset="30%" stopColor="#1655BE" />
          <stop offset="66%" stopColor="#0A2A5F" />
          <stop offset="100%" stopColor="#050D1E" />
        </radialGradient>
        <radialGradient id="gfxa-sheen" cx="30%" cy="20%" r="55%">
          <stop offset="0%" stopColor="#BFDCFF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#BFDCFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gfxa-ring-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0B2B5E" />
          <stop offset="45%" stopColor="#1E5FCC" />
          <stop offset="100%" stopColor="#2A7FFF" />
        </linearGradient>
        <linearGradient id="gfxa-ring-front" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A7FFF" />
          <stop offset="26%" stopColor="#DCE4EF" />
          <stop offset="55%" stopColor="#F6F9FD" />
          <stop offset="100%" stopColor="#7E8CA3" />
        </linearGradient>
        <linearGradient id="gfxa-green" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#009C70" />
          <stop offset="50%" stopColor="#00D094" />
          <stop offset="100%" stopColor="#8CF3C0" />
        </linearGradient>
        <linearGradient id="gfxa-silver" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#5F6878" />
          <stop offset="100%" stopColor="#D2D8E2" />
        </linearGradient>
        <linearGradient id="gfxa-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#9AA5B6" />
        </linearGradient>
        <clipPath id="gfxa-globe-clip">
          <circle cx="29" cy="32" r="17.5" />
        </clipPath>
      </defs>
    </svg>
  );
}

export function LogoMark({
  title,
  ...props
}: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}

      {/* Orbital ring - rear pass, occluded by the globe */}
      <ellipse
        cx="29"
        cy="33"
        rx="28"
        ry="8.6"
        transform="rotate(-20 29 33)"
        stroke={U.ringBack}
        strokeWidth="3"
        fill="none"
      />

      {/* Globe body */}
      <circle cx="29" cy="32" r="17.5" fill={U.globe} />
      <g clipPath={U.clip}>
        {/* graticule */}
        <g stroke="#8FC2FF" fill="none" opacity="0.22">
          <ellipse cx="29" cy="32" rx="17.5" ry="6" strokeWidth="0.45" />
          <ellipse cx="29" cy="32" rx="17.5" ry="12.6" strokeWidth="0.4" />
          <ellipse cx="29" cy="32" rx="6" ry="17.5" strokeWidth="0.45" />
          <ellipse cx="29" cy="32" rx="12.6" ry="17.5" strokeWidth="0.4" />
          <path d="M11.5 32h35M29 14.5v35" strokeWidth="0.45" />
        </g>
        {/* continents */}
        <path d={LANDMASS} fill="#E4EAF3" opacity="0.82" />
        {/* specular sheen + limb darkening */}
        <circle cx="29" cy="32" r="17.5" fill={U.sheen} />
        <circle cx="29" cy="32" r="17.5" fill="none" stroke="#040A16" strokeWidth="6" opacity="0.45" />
      </g>

      {/* Candlesticks - two silver at the base, four green advancing */}
      <g>
        {(
          [
            [31.5, 39.5, 49.5, 42, 47.5, false],
            [35.5, 33.5, 44.5, 36, 42.5, false],
            [39.5, 26.5, 39, 29, 37, true],
            [43, 21, 34, 23.5, 32, true],
            [46.5, 15.5, 29, 18, 27, true],
            [50, 10, 24.5, 12.5, 22.5, true],
          ] as [number, number, number, number, number, boolean][]
        ).map(([x, wt, wb, bt, bb, green], i) => (
          <g key={i}>
            <rect
              x={x + 1.1}
              y={wt}
              width="0.8"
              height={wb - wt}
              rx="0.4"
              fill={green ? "#00D094" : "#AEB7C6"}
            />
            <rect
              x={x}
              y={bt}
              width="3"
              height={bb - bt}
              rx="0.5"
              fill={green ? U.green : U.silver}
            />
          </g>
        ))}
      </g>

      {/* Orbital ring - front pass, crossing over the globe */}
      <path
        d="M55.3 24.4A28 8.6 -20 0 1 2.7 41.6"
        stroke={U.ringFront}
        strokeWidth="2.9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M55.3 24.4A28 8.6 -20 0 1 2.7 41.6"
        stroke="#FFFFFF"
        strokeWidth="0.7"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* Twin stars */}
      <path
        d="M56.4 4.2 57.5 7.4 60.9 7.5 58.2 9.6 59.2 12.8 56.4 10.9 53.6 12.8 54.6 9.6 51.9 7.5 55.3 7.4Z"
        fill={U.star}
      />
      <path
        d="M50 9.4 50.7 11.5 52.9 11.6 51.1 13 51.8 15.1 50 13.8 48.2 15.1 48.9 13 47.1 11.6 49.3 11.5Z"
        fill="#9BA5B5"
      />
    </svg>
  );
}
