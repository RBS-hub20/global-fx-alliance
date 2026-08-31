import type { ReactNode } from "react";

interface SectionProps {
  id?: string;
  kicker?: string;
  title?: ReactNode;
  lede?: string;
  children: ReactNode;
  className?: string;
  align?: "center" | "left";
}

export function Section({
  id,
  kicker,
  title,
  lede,
  children,
  className = "",
  align = "center",
}: SectionProps) {
  return (
    <section id={id} className={`relative py-24 lg:py-32 ${className}`}>
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8">
        {kicker || title || lede ? (
          <div className={align === "center" ? "mx-auto max-w-[760px] text-center" : "max-w-[760px]"}>
            {kicker ? <p className="kicker">{kicker}</p> : null}
            {title ? (
              <h2 className="headline mt-4 text-[clamp(30px,4.4vw,48px)] leading-[1.06]">{title}</h2>
            ) : null}
            {lede ? (
              <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">{lede}</p>
            ) : null}
          </div>
        ) : null}
        <div className={kicker || title ? "mt-16" : ""}>{children}</div>
      </div>
    </section>
  );
}
