import Image from "next/image";
import lockup from "../../../public/brand/gfxa-logo-trim.png";

/**
 * GFXA COMMUNITY lockup — the raster supplied as the brand master
 * (public/brand/gfxa-logo.png), trimmed of its empty margin.
 *
 * A PNG rather than a traced SVG on purpose: tracing a rendered, lit 3D
 * wordmark would redraw it, not reproduce it. next/image serves a size-matched
 * 1x/2x version, so it stays crisp at every height it is used at.
 *
 * The alt text keeps "Global FX Alliance" alongside the new mark so the name
 * the site has been indexed under stays attached to it.
 *
 * Legibility note: the LEARN • CONNECT • ANALYZE • GROW line is 1/13 of the
 * lockup's height, so it only reads as text from about 96px tall (footer,
 * auth pages). At navbar size it is texture — GFXA and COMMUNITY carry it.
 */

const RATIO = lockup.width / lockup.height;

export function Logo({
  height = 48,
  className = "",
  priority = false,
}: {
  /** Largest height it is shown at, in px — sets the srcset. Size it with className for breakpoints. */
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={lockup}
      alt="GFXA Community — Global FX Alliance"
      title="GFXA Community"
      height={height}
      width={Math.round(height * RATIO)}
      priority={priority}
      quality={90}
      className={`block w-auto select-none ${className}`}
      style={{ height }}
      draggable={false}
    />
  );
}
