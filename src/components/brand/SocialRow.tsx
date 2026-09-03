import { AtSign, Facebook, Instagram, MessagesSquare, Music2, Send, Youtube, type LucideIcon } from "lucide-react";
import { SOCIALS, type SocialId } from "@/lib/socials";

/**
 * The official accounts, wherever they appear.
 *
 * Renders nothing at all when none are configured — an empty "Follow us" row
 * with no links reads as broken, and there is no honest link to show until the
 * real URLs are set.
 */

export const SOCIAL_ICON: Record<SocialId, LucideIcon> = {
  facebook: Facebook,
  tiktok: Music2,
  telegram: Send,
  telegramChat: MessagesSquare,
  youtube: Youtube,
  instagram: Instagram,
  x: AtSign,
};

export function SocialRow({
  size = "md",
  className = "",
  showHandles = false,
}: {
  size?: "sm" | "md";
  className?: string;
  showHandles?: boolean;
}) {
  if (!SOCIALS.length) return null;

  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`}>
      {SOCIALS.map((s) => {
        const Icon = SOCIAL_ICON[s.id];
        return (
          <li key={s.id}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${s.label} — opens in a new tab`}
              className={`group inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] text-ink-muted transition-all duration-200 hover:border-brand-blue/40 hover:text-white ${
                showHandles ? "px-3 py-1.5" : `${box} justify-center`
              }`}
            >
              <Icon className={`${icon} shrink-0`} strokeWidth={1.9} />
              {showHandles ? <span className="text-[12px] font-medium">{s.label}</span> : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
