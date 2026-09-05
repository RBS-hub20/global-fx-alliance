import { BrandIcon } from "@/components/brand/BrandIcon";
import { SOCIALS } from "@/lib/socials";

/**
 * The official accounts, wherever they appear.
 *
 * Renders nothing when none are configured — an empty "Follow us" row with no
 * links reads as broken, and there is no honest link to show until a real URL
 * exists. Each button takes the platform's own colour on hover, which is what
 * makes a row of circles scannable at a glance.
 */
export function SocialRow({
  size = "md",
  className = "",
  showLabels = false,
}: {
  size?: "sm" | "md";
  className?: string;
  showLabels?: boolean;
}) {
  if (!SOCIALS.length) return null;

  const box = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";

  return (
    <ul className={`flex flex-wrap items-center gap-2.5 ${className}`}>
      {SOCIALS.map((s) => (
        <li key={s.id}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${s.label} — ${s.handle}`}
            aria-label={`${s.label} (opens in a new tab)`}
            style={{ ["--brand" as string]: s.color }}
            className={`group inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] text-ink-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:bg-[var(--brand)] hover:text-white hover:shadow-[0_6px_18px_-6px_var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${
              showLabels ? "px-3.5 py-2" : `${box} justify-center`
            }`}
          >
            <BrandIcon id={s.id} className={`${icon} shrink-0`} />
            {showLabels ? <span className="text-[12px] font-medium">{s.label}</span> : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
