/**
 * Launch configuration — the single place community-facing numbers are declared.
 *
 * `verified` marks whether a figure reflects real, countable data. Anything with
 * `verified: false` is pre-launch positioning and must never be rendered as a
 * factual claim about existing members: the site has no registered users yet, and
 * inventing a member count in a financial context is the kind of thing that costs
 * trust exactly once. Flip the values and the flag together when real numbers exist.
 */

export interface Stat {
  value: string;
  label: string;
  verified: boolean;
}

/** True, countable facts about the product itself. */
export const PRODUCT_STATS: Stat[] = [
  { value: "17", label: "Pro Tools", verified: true },
  { value: "8", label: "Instruments", verified: true },
  { value: "4", label: "AI Agents", verified: true },
  { value: "8", label: "Global Chapters", verified: true },
  { value: "24/7", label: "Market Analysis", verified: true },
];

/**
 * Community figures. Currently the founding-cohort target, not a headcount —
 * hence `verified: false` and the "target" framing everywhere they render.
 */
export const COMMUNITY_TARGET = {
  members: 2480,
  countries: 40,
  verified: false,
} as const;

export const LAUNCH_STAGE = "pre-launch" as const;

/** Marketing copy, written so it is true today. */
export const COPY = {
  tagline: "The Global Community for Forex Traders",
  heroClaim: "A Bloomberg-style AI terminal and pro auto-drawn charts, built for traders who want to understand the market — not be told what to trade.",
  waitlistHeadline: "Be a founding member of GFXA Pro",
  waitlistSub: "Early access to the AI Terminal, pro charts and your country chapter.",
  seoDescription:
    "A Bloomberg-style AI terminal for forex traders: 4-agent market analysis, TradingView-grade charts with auto-drawn support, resistance and fair-value gaps, trading calculator, economic calendar and journal. Educational only — not financial advice.",
  ogSubtitle: "AI Terminal · Pro Auto-Drawn Charts · Global Chapters",
} as const;

export const WAITLIST_BENEFITS = [
  "Pro auto-drawn charts — support, resistance, trendlines, fair-value gaps",
  "Bloomberg-style AI terminal with four analyst agents",
  "Your country chapter, and the tools that go with it",
] as const;
