"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/brand/LogoMark";

/**
 * Hero visual.
 *
 * Plays `/videos/gfxa-promo.mp4` when that file exists and falls back to an
 * animated backdrop when it does not — dropping the clip into `public/videos/`
 * is the whole install step. Referencing a missing file unconditionally would
 * leave a black rectangle on the most important screen of the funnel, so the
 * failure is caught and the fallback is a finished design in its own right
 * rather than a placeholder.
 */
export function HeroMedia() {
  const [videoOk, setVideoOk] = useState(true);
  const ref = useRef<HTMLVideoElement>(null);
  const src = process.env.NEXT_PUBLIC_JOIN_VIDEO_URL || "/videos/gfxa-promo.mp4";

  /*
   * The src is in the server-rendered HTML, so a missing file fails while the
   * page is still hydrating — before React attaches `onError`, which then never
   * runs and leaves the hero black. Checking `video.error` once on mount catches
   * the failure that already happened; `onError` catches any that come later.
   */
  useEffect(() => {
    if (ref.current?.error) setVideoOk(false);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {videoOk ? (
        <video
          // `src` on the element rather than a <source> child: a 404 on a child
          // fires the error event on the <source>, where it does not bubble, so
          // the fallback never ran and the hero stayed black.
          ref={ref}
          src={src}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onError={() => setVideoOk(false)}
          className="h-full w-full object-cover opacity-70"
        />
      ) : (
        <Fallback />
      )}
      {/* Keeps the headline legible over any footage the clip happens to contain. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070A12]/70 via-[#070A12]/60 to-[#070A12]" />
    </div>
  );
}

/** Drifting candles behind the mark — motion without a video file. */
function Fallback() {
  const bars = [38, 62, 30, 74, 46, 88, 54, 70, 34, 60, 44, 80];
  return (
    <div className="relative h-full w-full bg-[radial-gradient(120%_90%_at_50%_0%,#12224A_0%,#0A1128_45%,#070A12_100%)]">
      <div className="absolute inset-x-0 bottom-0 flex h-[62%] items-end justify-center gap-[2.2%] px-6 opacity-[0.28]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[4.4%] animate-riseIn rounded-sm"
            style={{
              height: `${h}%`,
              animationDelay: `${i * 90}ms`,
              background:
                i % 3 === 0
                  ? "linear-gradient(180deg,#00D094,rgba(0,208,148,0.05))"
                  : "linear-gradient(180deg,#2A7FFF,rgba(42,127,255,0.05))",
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <LogoMark width={104} height={104} className="opacity-30" />
      </div>
    </div>
  );
}
