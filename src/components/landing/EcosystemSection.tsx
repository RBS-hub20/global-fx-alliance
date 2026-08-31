import { Users, GraduationCap, BarChart3, Sparkles, CalendarDays, Trophy, MapPin } from "lucide-react";
import { Section } from "./Section";

const BLOCKS = [
  { icon: Users, name: "GFXA COMMUNITY", role: "Main network", wide: true },
  { icon: GraduationCap, name: "GFXA ACADEMY", role: "Education" },
  { icon: BarChart3, name: "GFXA INTELLIGENCE", role: "Research" },
  { icon: Sparkles, name: "GFXA AI", role: "Tools" },
  { icon: CalendarDays, name: "GFXA EVENTS", role: "Webinars" },
  { icon: Trophy, name: "GFXA CHAMPIONSHIP", role: "Competitions" },
  { icon: MapPin, name: "GFXA CHAPTERS", role: "Country communities" },
];

export function EcosystemSection() {
  return (
    <Section
      id="ecosystem"
      kicker="The stack"
      title="GLOBAL FX ALLIANCE ECOSYSTEM"
      lede="Seven connected surfaces — one membership, one identity, one reputation that follows you across all of them."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BLOCKS.map(({ icon: Icon, name, role, wide }) => (
          <div
            key={name}
            className={`group relative overflow-hidden rounded-2xl glass card-hover p-7 ${
              wide ? "lg:col-span-2" : ""
            }`}
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-blue/0 blur-3xl transition-all duration-200 group-hover:bg-brand-blue/20" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-bold tracking-[0.06em] text-white">{name}</h3>
                <p className="mt-2 text-[14px] text-ink-muted">{role}</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-ink-muted transition-colors duration-200 group-hover:border-brand-blue/30 group-hover:text-brand-blue">
                <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
