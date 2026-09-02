import {
  LayoutDashboard, Globe2, LineChart, Newspaper, Star, Radar, ClipboardList, Users, MessagesSquare,
  GraduationCap, Trophy, MapPin, Calculator, CalendarDays, NotebookPen, Camera, Sparkles,
  UserRound, BadgeCheck, Settings, type LucideIcon,
} from "lucide-react";

/**
 * The dashboard is a single route driven by `?tab=`, so every panel is
 * shareable and back/forward works, without paying a full navigation for each
 * sidebar click. This registry is the only place tabs are declared — the
 * sidebar, the mobile bar and the content switch all read from it.
 */
export interface TabDef {
  slug: string;
  label: string;
  icon: LucideIcon;
  group: "Main" | "Community" | "Tools" | "Account";
  /** Shown in the sticky header under the page title. */
  blurb: string;
  badge?: string;
}

export const TABS: TabDef[] = [
  { slug: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Main", blurb: "Here's what's happening across the global market." },
  { slug: "market-overview", label: "Market Overview", icon: Globe2, group: "Main", blurb: "Every instrument the Alliance tracks, at a glance." },
  { slug: "market-analysis", label: "Market Analysis", icon: LineChart, group: "Main", blurb: "Structure, momentum and levels, pair by pair." },
  { slug: "pattern-radar", label: "Pattern Radar", icon: Radar, group: "Main", blurb: "Setups the scanner found on real price data." },
  { slug: "market-news", label: "Market News", icon: Newspaper, group: "Main", blurb: "Headlines that are actually moving price." },
  { slug: "journal-analytics", label: "Journal Analytics", icon: ClipboardList, group: "Main", blurb: "Upload your broker statement and see why you lose." },
  { slug: "watchlist", label: "Watchlist", icon: Star, group: "Main", blurb: "The pairs you're tracking, saved to this device." },

  { slug: "community", label: "Community", icon: Users, group: "Community", blurb: "What traders around the world are posting right now." },
  { slug: "discussions", label: "Discussions", icon: MessagesSquare, group: "Community", blurb: "Longer-form threads on the questions that keep coming up.", badge: "12" },
  { slug: "academy", label: "Academy", icon: GraduationCap, group: "Community", blurb: "Three tracks, from first principles to execution." },
  { slug: "challenges", label: "Challenges", icon: Trophy, group: "Community", blurb: "Analysis competitions judged on reasoning, not returns." },
  { slug: "chapters", label: "Global Chapters", icon: MapPin, group: "Community", blurb: "Country communities inside the Alliance." },

  { slug: "calculator", label: "Trading Calculator", icon: Calculator, group: "Tools", blurb: "Position size, pip value, profit and margin." },
  { slug: "calendar", label: "Economic Calendar", icon: CalendarDays, group: "Tools", blurb: "Scheduled releases and what they tend to move." },
  { slug: "journal", label: "Trading Journal", icon: NotebookPen, group: "Tools", blurb: "Log every trade and let the numbers argue back." },
  { slug: "chart-snap", label: "Chart Snap", icon: Camera, group: "Tools", blurb: "Screenshot your chart, get a worked plan from live data." },
  { slug: "ai", label: "AI Tools", icon: Sparkles, group: "Tools", blurb: "Ask the market a question. Education, not advice." },

  { slug: "profile", label: "My Profile", icon: UserRound, group: "Account", blurb: "Your identity across the Alliance." },
  { slug: "membership", label: "Membership", icon: BadgeCheck, group: "Account", blurb: "Your plan, benefits and billing." },
  { slug: "settings", label: "Settings", icon: Settings, group: "Account", blurb: "Preferences, notifications and privacy." },
];

export const TAB_GROUPS: TabDef["group"][] = ["Main", "Community", "Tools", "Account"];

export const TAB_BY_SLUG: Record<string, TabDef> = Object.fromEntries(
  TABS.map((t) => [t.slug, t])
);

export const DEFAULT_TAB = "dashboard";

export function resolveTab(slug: string | null | undefined): TabDef {
  return (slug && TAB_BY_SLUG[slug]) || TAB_BY_SLUG[DEFAULT_TAB];
}

/** Deep link to a tab, optionally preselecting a pair. */
export function tabHref(slug: string, pair?: string): string {
  const base = slug === DEFAULT_TAB ? "/dashboard" : `/dashboard?tab=${slug}`;
  if (!pair) return base;
  return `${base}${slug === DEFAULT_TAB ? "?" : "&"}pair=${encodeURIComponent(pair)}`;
}

/** Bottom bar on mobile — five destinations mapped onto the tab registry. */
export const MOBILE_TABS = [
  { slug: "dashboard", label: "Home" },
  { slug: "market-overview", label: "Markets" },
  { slug: "ai", label: "AI" },
  { slug: "community", label: "Community" },
  { slug: "profile", label: "Profile" },
] as const;
