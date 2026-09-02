import type { SVGProps } from "react";

/**
 * The GFXA AI mark: a ribboned "A" in electric blue with a four-point star held
 * in its counter, over an optional navy plate.
 *
 * Drawn rather than imported as a raster. The supplied artwork is a 1024px JPEG
 * with the navy plate baked in, so it cannot sit on the app's own surfaces
 * without carrying its own background, and it turns muddy at the 17-24px this
 * mark is actually used at. As geometry it stays crisp at every size, needs no
 * PNG ladder, and costs about a kilobyte.
 *
 * The same geometry is mirrored as standalone files in public/icons/ for uses
 * that cannot mount a React component — favicon, social cards, app-store icon.
 * Those are exports of this mark, so a change here should be copied across.
 *
 * Gradients live in <AiMarkDefs />, mounted once in the root layout, for the same
 * reason the emblem's do: per-instance <defs> either duplicate identical markup
 * or need generated ids, and generated ids desynchronise between the server and
 * client renders and trip React's hydration check.
 */

/** Both legs and the apex as one stroked ribbon; round joins give the curl. */
const LIMBS =
  "M11.6 50.2C8.8 43.6 10.2 39.4 13.0 34.8L28.6 11.4C30.0 9.0 34.0 9.0 35.4 11.4L51.0 34.8C53.8 39.4 55.2 43.6 52.4 50.2";

/** The darker underside of each foot, where the ribbon folds under itself. */
const FOLD_L = "M11.4 47.6c-1.2 3.6-.2 6.4 3.2 6.9 3.4.5 5.6-1.6 6.2-4.6z";
const FOLD_R = "M52.6 47.6c1.2 3.6.2 6.4-3.2 6.9-3.4.5-5.6-1.6-6.2-4.6z";

/** Four-point star with concave sides, floating in the counter below the apex. */
const STAR =
  "M32 28.6C33.3 34.6 35.3 37.4 41.4 39.3C35.3 41.2 33.3 44.0 32 50.0C30.7 44.0 28.7 41.2 22.6 39.3C28.7 37.4 30.7 34.6 32 28.6Z";

export function AiMarkDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute" focusable="false">
      <defs>
        <linearGradient id="gfxa-ai-limb" x1="32" y1="7" x2="32" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3FE4FF" />
          <stop offset="34%" stopColor="#00D9FF" />
          <stop offset="72%" stopColor="#2A7FFF" />
          <stop offset="100%" stopColor="#0055F0" />
        </linearGradient>
        <linearGradient id="gfxa-ai-fold" x1="32" y1="40" x2="32" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0B2E7A" />
          <stop offset="100%" stopColor="#123F9E" />
        </linearGradient>
        <linearGradient id="gfxa-ai-star" x1="32" y1="28" x2="32" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9BF7FF" />
          <stop offset="100%" stopColor="#00D5FF" />
        </linearGradient>
        <linearGradient id="gfxa-ai-plate" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#101B3A" />
          <stop offset="100%" stopColor="#060B1A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface AiMarkProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  width?: number | string;
  height?: number | string;
  title?: string;
  /** Draws the navy rounded-square plate behind the mark, as on the app icon. */
  plate?: boolean;
  /**
   * Flat `currentColor` silhouette. The blue gradient has almost no contrast on
   * a filled brand-blue row, so the sidebar's active state uses this instead.
   * The star still reads because it floats clear of the limbs.
   */
  mono?: boolean;
}

export function AiMark({
  width = 24,
  height = 24,
  title,
  plate = false,
  mono = false,
  ...rest
}: AiMarkProps) {
  const limb = mono ? "currentColor" : "url(#gfxa-ai-limb)";
  const star = mono ? "currentColor" : "url(#gfxa-ai-star)";

  return (
    <svg
      viewBox="0 0 64 64"
      width={width}
      height={height}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {plate ? <rect x="0" y="0" width="64" height="64" rx="14.5" fill="url(#gfxa-ai-plate)" /> : null}
      {mono ? null : (
        <>
          <path d={FOLD_L} fill="url(#gfxa-ai-fold)" />
          <path d={FOLD_R} fill="url(#gfxa-ai-fold)" />
        </>
      )}
      <path d={LIMBS} fill="none" stroke={limb} strokeWidth="10.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={STAR} fill={star} />
    </svg>
  );
}
