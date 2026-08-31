import { Section } from "./Section";

const ITEMS = [
  {
    n: "01",
    title: "Market Education",
    body: "Structured lessons on price action, risk, macro and execution — built by traders who trade.",
  },
  {
    n: "02",
    title: "Market Discussions",
    body: "Daily threads on the pairs that are actually moving, across every session.",
  },
  {
    n: "03",
    title: "Trader Networking",
    body: "Find peers, mentors and accountability partners in your region and your timezone.",
  },
  {
    n: "04",
    title: "Trading Tools",
    body: "Position sizing, journaling and an economic calendar wired into one workspace.",
  },
  {
    n: "05",
    title: "AI & Market Intelligence",
    body: "Ask questions of the market and get context — not signals, not certainty.",
  },
  {
    n: "06",
    title: "Events & Competitions",
    body: "Webinars, regional meetups and the GFXA Championship season.",
  },
];

export function MembersSection() {
  return (
    <Section
      id="what-members-get"
      kicker="What members get"
      title="Your Trading Journey. One Alliance."
      lede="Everything a serious trader needs to keep improving, in one place — and a community that keeps you honest."
    >
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((it) => (
          <div
            key={it.n}
            className="group relative bg-[rgba(16,22,38,0.8)] p-8 transition-colors duration-200 hover:bg-[rgba(23,32,54,0.9)]"
          >
            <span className="num-mono block text-[40px] font-bold leading-none text-white/[0.07] transition-colors duration-200 group-hover:text-brand-blue/25">
              {it.n}
            </span>
            <h3 className="mt-5 text-[17px] font-bold tracking-tight text-white">{it.title}</h3>
            <p className="mt-2.5 text-[14px] leading-relaxed text-ink-muted">{it.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
