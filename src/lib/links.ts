/**
 * Every landing-page destination in one place, so the navbar, the footer and the
 * scroll-spy can never drift apart. Anything starting with "#" is an in-page
 * anchor (sections carry scroll-margin-top so the sticky navbar does not cover
 * the heading); anything else is a route or an external URL.
 */

/** Dispatched on window when the Chapters nav item is clicked. */
export const HIGHLIGHT_CHAPTERS = "gfxa:highlight-chapters";

export interface NavLink {
  label: string;
  href: string;
  /**
   * Section watched by the scroll-spy for this link's active state. Usually the
   * same as `href`, but Chapters scrolls to the world map while lighting up over
   * the chapter grid that follows it, so the two differ there.
   */
  spy: string;
  /** Fired on click so a section can react to being navigated to. */
  event?: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: "Community", href: "#global-community", spy: "global-community" },
  { label: "Academy", href: "#what-members-get", spy: "what-members-get" },
  { label: "Intelligence", href: "#market-intelligence-preview", spy: "market-intelligence-preview" },
  { label: "Events", href: "#ecosystem", spy: "ecosystem" },
  {
    label: "Chapters",
    href: "#global-community",
    spy: "chapters-preview",
    event: HIGHLIGHT_CHAPTERS,
  },
];

/** Spied sections in document order - the spy picks the last one above the probe line. */
export const SPY_ORDER = [
  "market-intelligence-preview",
  "global-community",
  "chapters-preview",
  "what-members-get",
  "ecosystem",
] as const;

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Community",
    links: [
      { label: "About", href: "#why" },
      { label: "Membership", href: "#pro-trader" },
      { label: "Chapters", href: "#chapters-preview" },
      { label: "Events", href: "#ecosystem" },
    ],
  },
  {
    title: "Education",
    links: [
      { label: "Resources", href: "#what-members-get" },
      { label: "Market Insights", href: "#market-intelligence-preview" },
      { label: "Trading Tools", href: "/dashboard?ref=footer-tools#economic-calendar" },
      { label: "AI", href: "/dashboard?ref=footer-ai#ai-assistant" },
      { label: "Blog", href: "#blog-preview" },
    ],
  },
];

export const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://www.facebook.com/globalfxalliance" },
  { label: "Telegram", href: "https://t.me/globalfxalliance" },
  { label: "YouTube", href: "https://www.youtube.com/@globalfxalliance" },
  { label: "TikTok", href: "https://www.tiktok.com/@globalfxalliance" },
  { label: "Instagram", href: "https://www.instagram.com/globalfxalliance" },
] as const;
