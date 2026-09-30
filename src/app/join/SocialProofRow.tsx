/**
 * Members strip under the badge.
 *
 * Initials on gradient discs rather than photographs: a stock face implies a
 * member who does not exist. The count is the community's own claim; nothing
 * here presents it as a verified figure.
 */
const FACES = ["JT", "AK", "MS", "RD", "PT"];

export function SocialProofRow({ count = "5,000+" }: { count?: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 backdrop-blur-xl">
      <span className="flex -space-x-2">
        {FACES.map((f, i) => (
          <span
            key={f}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#0a0a0a] bg-gradient-to-br from-[#1F3D2E] to-[#0F1A14] text-[9px] font-bold text-[#00FF88]"
            style={{ zIndex: FACES.length - i }}
          >
            {f}
          </span>
        ))}
      </span>
      <span className="text-[12px] text-[#A3A3A3]">
        <span className="font-semibold text-white">{count}</span> traders inside
      </span>
    </div>
  );
}

/** Three numbers under the call to action. */
export function StatsRow({ className = "" }: { className?: string }) {
  const stats = [
    { v: "5,000+", l: "traders inside" },
    { v: "5", l: "Academy books" },
    { v: "$0", l: "to start" },
  ];
  return (
    <div className={`grid grid-cols-3 gap-3 ${className}`}>
      {stats.map((s) => (
        <div key={s.l} className="text-center">
          <p className="num-mono text-[17px] font-bold text-white sm:text-[19px]">{s.v}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-[#A3A3A3]">{s.l}</p>
        </div>
      ))}
    </div>
  );
}

/** Faint green grid behind the hero. */
export function GridBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,255,136,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.05) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
      }}
    />
  );
}
