import { Globe2, GraduationCap, LineChart, Users, Cpu, TrendingUp } from "lucide-react";
import { Section } from "./Section";

const PILLARS = [
  { icon: Globe2, title: "GLOBAL", body: "Connect with traders worldwide" },
  { icon: GraduationCap, title: "LEARN", body: "Education, concepts, strategies" },
  { icon: LineChart, title: "ANALYZE", body: "Share perspectives, setups, analysis" },
  { icon: Users, title: "CONNECT", body: "Build relationships with mentors" },
  { icon: Cpu, title: "INNOVATE", body: "Explore AI, automation, modern tech" },
  { icon: TrendingUp, title: "GROW", body: "Develop skills, discipline, journey" },
];

export function WhySection() {
  return (
    <Section
      id="why"
      kicker="Why the Alliance"
      title="One Market. One Global Community."
      lede="Forex is the largest market on earth and it never sleeps. The people trading it shouldn't have to do it alone."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="group rounded-2xl glass card-hover p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-blue/25 bg-brand-blue/10 text-brand-blue transition-colors duration-200 group-hover:bg-brand-blue/15">
              <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </div>
            <h3 className="mt-6 text-[15px] font-bold uppercase tracking-[0.12em] text-white">
              {title}
            </h3>
            <p className="mt-2.5 text-[14px] leading-relaxed text-ink-muted">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
