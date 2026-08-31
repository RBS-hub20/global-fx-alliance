import { WorldMap } from "@/components/ui/WorldMap";
import { SENTIMENT, SESSIONS, SESSION_NOW, type Session } from "@/lib/data";

const STATUS_STYLE: Record<Session["status"], { dot: string; text: string; ring: boolean }> = {
  ACTIVE: { dot: "bg-brand-green", text: "text-brand-green", ring: true },
  OPEN: { dot: "bg-brand-blue", text: "text-brand-blue", ring: true },
  UPCOMING: { dot: "bg-ink-muted/60", text: "text-ink-muted", ring: false },
  CLOSED: { dot: "bg-ink-muted/30", text: "text-ink-muted/60", ring: false },
};

/** Sessions wrap midnight, so render them as one or two bar segments. */
function segments(s: Session): [number, number][] {
  return s.start <= s.end ? [[s.start, s.end]] : [[s.start, 1], [0, s.end]];
}

export function MarketPulse() {
  return (
    <section className="relative overflow-hidden rounded-2xl glass">
      <div className="pointer-events-none absolute inset-0 opacity-[0.13]">
        <WorldMap density={104} dotOpacity={1} fit="slice" className="h-full w-full" />
      </div>

      <div className="relative">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-6 py-4">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-white">
            Global Market Pulse
          </h2>
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-60 animate-pulseRing" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
            </span>
            Live
          </span>
        </header>

        <div className="grid grid-cols-1 divide-y divide-white/[0.08] lg:grid-cols-[1.35fr_1fr] lg:divide-x lg:divide-y-0">
          {/* Sessions */}
          <div className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Trading Sessions
            </p>

            <ul className="mt-5 space-y-3.5">
              {SESSIONS.map((s) => {
                const st = STATUS_STYLE[s.status];
                return (
                  <li key={s.city}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2.5">
                        <span className="relative flex h-2 w-2">
                          {st.ring ? (
                            <span
                              className={`absolute inline-flex h-full w-full rounded-full ${st.dot} opacity-60 animate-pulseRing`}
                            />
                          ) : null}
                          <span className={`relative inline-flex h-2 w-2 rounded-full ${st.dot}`} />
                        </span>
                        <span className="text-[13.5px] font-semibold text-ink">{s.city}</span>
                        <span className="text-[11px] text-ink-muted/70">{s.zone}</span>
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-[0.14em] ${st.text}`}
                      >
                        {s.status}
                      </span>
                    </div>

                    {/* 24h rail */}
                    <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      {segments(s).map(([a, b], i) => (
                        <span
                          key={i}
                          className={`absolute inset-y-0 rounded-full ${
                            s.status === "UPCOMING" ? "bg-white/15" : st.dot
                          } ${s.status === "UPCOMING" ? "" : "opacity-70"}`}
                          style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%` }}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10.5px] text-ink-muted/70">{s.hours}</p>
                  </li>
                );
              })}
            </ul>

            {/* now marker across the shared timeline */}
            <div className="relative mt-6">
              <div className="h-px w-full bg-white/[0.08]" />
              <span
                className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-white shadow-glow"
                style={{ left: `${SESSION_NOW * 100}%` }}
              />
              <div className="mt-2 flex justify-between text-[10px] num-mono text-ink-muted/60">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>
          </div>

          {/* Sentiment */}
          <div className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Market Sentiment
            </p>

            <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full">
              {SENTIMENT.map((s) => (
                <span
                  key={s.label}
                  style={{ width: `${s.value}%`, background: s.color }}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                />
              ))}
            </div>

            <ul className="mt-6 space-y-4">
              {SENTIMENT.map((s) => (
                <li key={s.label}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-ink">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: s.color }}
                        aria-hidden
                      />
                      {s.label}
                    </span>
                    <span className="num-mono font-semibold text-white">{s.value}%</span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${s.value}%`, background: s.color, opacity: 0.85 }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-[11.5px] leading-relaxed text-ink-muted/70">
              Aggregated from Alliance member positioning and posted bias. Community signal, not a
              recommendation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
