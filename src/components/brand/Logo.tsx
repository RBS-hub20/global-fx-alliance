import { LogoMark } from "./LogoMark";

interface LogoProps {
  size?: number;
  /** Renders "The Global Community" beneath the wordmark. */
  tagline?: boolean;
  wordmarkClass?: string;
  className?: string;
}

/**
 * Full lockup: emblem + metallic "GLOBAL FX" / electric-blue "ALLIANCE" wordmark.
 * The metallic sheen is a clipped gradient rather than an image so it stays sharp
 * at any size and inherits the page's dark background.
 */
export function Logo({ size = 34, tagline = false, wordmarkClass = "text-[15px]", className = "" }: LogoProps) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark width={size} height={size} className="shrink-0" title="GLOBAL FX ALLIANCE" />
      <span className="flex flex-col justify-center leading-none">
        <span className={`font-bold tracking-[-0.015em] ${wordmarkClass}`}>
          <span className="bg-gradient-to-b from-white via-[#C7CDD8] to-[#848D9F] bg-clip-text text-transparent">
            GLOBAL FX
          </span>{" "}
          <span className="bg-gradient-to-b from-[#6FB0FF] via-[#2A7FFF] to-[#1B5FD0] bg-clip-text text-transparent">
            ALLIANCE
          </span>
        </span>
        {tagline ? (
          <span className="mt-[5px] text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            The Global Community
          </span>
        ) : null}
      </span>
    </span>
  );
}
