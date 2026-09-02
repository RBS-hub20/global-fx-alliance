import { AiMark } from "@/components/brand/AiMark";
import type { TabDef } from "@/lib/tabs";

/**
 * The AI tab carries the brand mark; every other tab uses its lucide glyph.
 *
 * `onFilled` is for the sidebar's active row, which is solid brand-blue — the
 * mark's own blue gradient nearly disappears against it, so there it falls back
 * to a flat white silhouette and matches the weight of the other nineteen icons.
 */
export function TabIcon({
  tab,
  className,
  strokeWidth = 1.8,
  onFilled = false,
}: {
  tab: TabDef;
  className?: string;
  strokeWidth?: number;
  onFilled?: boolean;
}) {
  if (tab.slug === "ai") return <AiMark className={className} mono={onFilled} width="100%" height="100%" />;
  return <tab.icon className={className} strokeWidth={strokeWidth} />;
}
