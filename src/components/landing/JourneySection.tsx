const STAGES = [
  {
    label: "BEGINNER",
    body: "Learn foundations",
    detail: "Mechanics, terminology, risk — the groundwork before a single position.",
  },
  {
    label: "DEVELOPING TRADER",
    body: "Build strategy & discipline",
    detail: "A repeatable process, a journal that tells the truth, and rules you keep.",
  },
  {
    label: "PRO TRADER",
    body: "Refine execution & risk",
    detail: "Sharper entries, tighter risk, and a peer group operating at the same level.",
  },
];

export function JourneySection() {
  return (
    <section id="pro-trader" className="relative overflow-hidden py-24 lg:py-32">
      <div
        className="orb left-1/2 top-6 h-[420px] w-[560px] -translate-x-1/2"
        style={{ ["--orb" as string]: "rgba(42,127,255,0.14)" }}
      />
      <div className="relative mx-auto max-w-[1280px] px-5 lg:px-8">
        <h2 className="headline mx-auto max-w-[18ch] text-center text-[clamp(30px,4.6vw,52px)] leading-[1.04]">
          NOT JUST A TRADING GROUP.
          <br />
          <span className="bg-gradient-to-r from-[#6FB0FF] to-[#2A7FFF] bg-clip-text text-transparent">
            A GLOBAL TRADER NETWORK.
          </span>
        </h2>

        <div className="relative mt-20">
          {/* connector rail */}
          <div className="absolute left-0 right-0 top-[22px] hidden h-px lg:block">
            <div className="mx-[16.6%] h-px bg-gradient-to-r from-brand-blue/10 via-brand-blue/50 to-brand-green/50" />
          </div>

          <ol className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8">
            {STAGES.map((s, i) => (
              <li key={s.label} className="relative text-center">
                <div className="flex justify-center">
                  <span
                    className={`relative flex h-11 w-11 items-center justify-center rounded-full border text-[13px] font-bold num-mono ${
                      i === 2
                        ? "border-brand-green/40 bg-brand-green/10 text-brand-green shadow-glow-green"
                        : "border-brand-blue/40 bg-brand-blue/10 text-brand-blue shadow-glow"
                    }`}
                  >
                    <span className="absolute inset-0 rounded-full bg-navy-950" />
                    <span className="relative">0{i + 1}</span>
                  </span>
                </div>
                <h3
                  className={`mt-6 text-[14px] font-bold uppercase tracking-[0.16em] ${
                    i === 2 ? "text-brand-green" : "text-white"
                  }`}
                >
                  {s.label}
                </h3>
                <p className="mt-2 text-[17px] font-semibold tracking-tight text-white">{s.body}</p>
                <p className="mx-auto mt-3 max-w-[34ch] text-[14px] leading-relaxed text-ink-muted">
                  {s.detail}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <p className="mx-auto mt-20 max-w-[46ch] text-center text-[17px] leading-relaxed text-brand-silver">
          Wherever you are in your journey, there is a place for you in the Alliance.
        </p>
      </div>
    </section>
  );
}
