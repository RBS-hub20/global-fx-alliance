/**
 * Mock market + community data.
 *
 * Every series is generated from a seeded PRNG at module scope so the server and
 * the client render byte-identical markup - a Math.random() walk here would blow
 * up hydration on every load.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random walk pinned to `from` and `to`: a raw walk is generated, then the
 * cumulative drift error is linearly detrended so the last point lands exactly
 * on the quoted close.
 */
function walk(seed: number, n: number, from: number, to: number, vol: number): number[] {
  const rnd = mulberry32(seed);
  const raw: number[] = [from];
  for (let i = 1; i < n; i++) {
    raw.push(raw[i - 1] + (rnd() - 0.5) * vol);
  }
  const drift = to - raw[n - 1];
  return raw.map((v, i) => Number((v + (drift * i) / (n - 1)).toFixed(6)));
}

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  decimals: number;
  spark: number[];
}

export const QUOTES: Quote[] = [
  {
    symbol: "EUR/USD",
    name: "Euro / US Dollar",
    price: 1.1742,
    change: 0.0049,
    changePct: 0.42,
    decimals: 4,
    spark: walk(11, 40, 1.1693, 1.1742, 0.0016),
  },
  {
    symbol: "GBP/USD",
    name: "British Pound / US Dollar",
    price: 1.3521,
    change: -0.0024,
    changePct: -0.18,
    decimals: 4,
    spark: walk(23, 40, 1.3545, 1.3521, 0.0019),
  },
  {
    symbol: "USD/JPY",
    name: "US Dollar / Japanese Yen",
    price: 147.42,
    change: 0.46,
    changePct: 0.31,
    decimals: 2,
    spark: walk(37, 40, 146.96, 147.42, 0.19),
  },
  {
    symbol: "XAU/USD",
    name: "Gold / US Dollar",
    price: 2648.9,
    change: 19.98,
    changePct: 0.76,
    decimals: 2,
    spark: walk(59, 40, 2628.92, 2648.9, 4.4),
  },
];

export type Range = "1D" | "1W" | "1M" | "3M" | "1Y";

export const RANGES: Range[] = ["1D", "1W", "1M", "3M", "1Y"];

interface RangeSeries {
  points: number[];
  labels: string[];
  changePct: number;
}

function labelsFor(range: Range, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    switch (range) {
      case "1D": {
        const mins = Math.round(t * 24 * 60);
        out.push(`${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`);
        break;
      }
      case "1W":
        out.push(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][Math.min(6, Math.round(t * 6))]);
        break;
      case "1M":
        out.push(`D${Math.max(1, Math.round(t * 30))}`);
        break;
      case "3M":
        out.push(["Jun", "Jul", "Aug", "Sep"][Math.min(3, Math.round(t * 3))]);
        break;
      case "1Y":
        out.push(
          ["Sep", "Nov", "Jan", "Mar", "May", "Jul", "Sep"][Math.min(6, Math.round(t * 6))]
        );
        break;
    }
  }
  return out;
}

/** EUR/USD history per range, all converging on the live 1.1742 close. */
export const EURUSD: Record<Range, RangeSeries> = {
  "1D": { points: walk(101, 96, 1.1693, 1.1742, 0.0011), labels: labelsFor("1D", 96), changePct: 0.42 },
  "1W": { points: walk(202, 84, 1.1608, 1.1742, 0.0018), labels: labelsFor("1W", 84), changePct: 1.15 },
  "1M": { points: walk(303, 90, 1.1489, 1.1742, 0.0031), labels: labelsFor("1M", 90), changePct: 2.2 },
  "3M": { points: walk(404, 92, 1.1201, 1.1742, 0.0052), labels: labelsFor("3M", 92), changePct: 4.83 },
  "1Y": { points: walk(505, 120, 1.0842, 1.1742, 0.0094), labels: labelsFor("1Y", 120), changePct: 8.3 },
};

export interface Session {
  city: string;
  zone: string;
  status: "ACTIVE" | "OPEN" | "UPCOMING" | "CLOSED";
  /** Local open/close as fractions of the 24h timeline, for the progress rail. */
  start: number;
  end: number;
  hours: string;
}

/** Timeline is anchored at 20:40 UTC - London/NY overlap has just closed out. */
export const SESSION_NOW = 0.6528;

export const SESSIONS: Session[] = [
  { city: "Sydney", zone: "APAC", status: "ACTIVE", start: 0.9167, end: 0.25, hours: "22:00 – 06:00 UTC" },
  { city: "Tokyo", zone: "APAC", status: "ACTIVE", start: 0.0, end: 0.375, hours: "00:00 – 09:00 UTC" },
  { city: "London", zone: "EMEA", status: "OPEN", start: 0.3333, end: 0.7083, hours: "08:00 – 17:00 UTC" },
  { city: "New York", zone: "AMER", status: "UPCOMING", start: 0.5417, end: 0.9167, hours: "13:00 – 22:00 UTC" },
];

export const SENTIMENT = [
  { label: "Bullish", value: 62, color: "#00D094" },
  { label: "Neutral", value: 23, color: "#8A93A8" },
  { label: "Bearish", value: 15, color: "#FF4D4D" },
];

export const TECHNICALS = [
  { label: "Trend", value: "Bullish", tone: "up" as const },
  { label: "Momentum", value: "Strong", tone: "up" as const },
  { label: "Volatility", value: "Medium", tone: "flat" as const },
];

export const FUNDAMENTALS = [
  "USD strength easing as rate-cut odds firm into Q4",
  "ECB commentary leaning less dovish than consensus",
  "3 high-impact events on the calendar this session",
];

export const AI_INSIGHT =
  "Price is grinding into the 1.1760 shelf that capped it twice this month. The move has been carried by dollar softness rather than euro demand, so the London/New York overlap is the tell: holding above 1.1750 keeps structure intact, losing 1.1710 hands it back to sellers.";

export const AI_CHIPS = [
  "Analyze EUR/USD",
  "What are today's major Forex events?",
  "Explain why gold moved today",
  "Compare USD strength",
];

export interface CalendarEvent {
  id: string;
  time: string;
  flag: string;
  currency: string;
  title: string;
  impact: "High" | "Medium" | "Low";
  actual: string;
  forecast: string;
  previous: string;
  detail: string;
  affects: string;
}

/** Today's releases. Times are UTC; `actual` is empty until a print lands. */
export const CALENDAR: CalendarEvent[] = [
  { id: "e1", time: "00:50", flag: "\u{1F1EF}\u{1F1F5}", currency: "JPY", title: "BoJ Policy Rate Decision", impact: "High", actual: "-0.10%", forecast: "-0.10%", previous: "-0.10%", affects: "USD/JPY",
    detail: "No change was the overwhelming consensus, so the reaction function here is asymmetric: a hold does nothing, any adjustment to yield curve control moves the yen hard." },
  { id: "e2", time: "06:00", flag: "\u{1F1EC}\u{1F1E7}", currency: "GBP", title: "Retail Sales (MoM)", impact: "Medium", actual: "-0.6%", forecast: "0.2%", previous: "0.4%", affects: "GBP/USD",
    detail: "A broad miss rather than one weak category, which makes it harder to dismiss. Sterling sold off roughly 40 pips and has not recovered." },
  { id: "e3", time: "08:00", flag: "\u{1F1EA}\u{1F1FA}", currency: "EUR", title: "Composite PMI (Final)", impact: "Medium", actual: "50.4", forecast: "50.1", previous: "49.8", affects: "EUR/USD",
    detail: "Back above the expansion line, carried by services. Manufacturing stays in contraction for a fourteenth month." },
  { id: "e4", time: "12:30", flag: "\u{1F1FA}\u{1F1F8}", currency: "USD", title: "Core PCE Price Index (MoM)", impact: "High", actual: "", forecast: "0.2%", previous: "0.3%", affects: "EUR/USD",
    detail: "The Fed's preferred inflation gauge and the single most important number on today's calendar. The three-month annualised rate is what policymakers have said they watch." },
  { id: "e5", time: "12:30", flag: "\u{1F1FA}\u{1F1F8}", currency: "USD", title: "Personal Spending (MoM)", impact: "Medium", actual: "", forecast: "0.4%", previous: "0.5%", affects: "USD/CHF",
    detail: "Released alongside PCE. Usually overshadowed, but a large divergence between spending and income gets attention." },
  { id: "e6", time: "13:45", flag: "\u{1F1EA}\u{1F1FA}", currency: "EUR", title: "ECB President Speech", impact: "High", actual: "", forecast: "\u2014", previous: "\u2014", affects: "EUR/USD",
    detail: "The last scheduled remarks before the blackout period. The hawkish wing has used the past two weeks to push back on early-cut pricing." },
  { id: "e7", time: "14:00", flag: "\u{1F1FA}\u{1F1F8}", currency: "USD", title: "Consumer Sentiment (Final)", impact: "High", actual: "", forecast: "68.4", previous: "67.9", affects: "EUR/USD",
    detail: "Revisions to the preliminary read are usually small, but the inflation-expectations sub-index has been moving markets more than the headline." },
  { id: "e8", time: "14:30", flag: "\u{1F1E8}\u{1F1E6}", currency: "CAD", title: "GDP (MoM)", impact: "Medium", actual: "", forecast: "0.1%", previous: "0.2%", affects: "USD/CHF",
    detail: "Monthly GDP is unusual as a release and tends to produce a clean, short-lived move in the Canadian dollar." },
  { id: "e9", time: "17:00", flag: "\u{1F1FA}\u{1F1F8}", currency: "USD", title: "Baker Hughes Rig Count", impact: "Low", actual: "", forecast: "\u2014", previous: "486", affects: "XAU/USD",
    detail: "Rarely a currency event. Included because energy desks watch it and it occasionally leaks into commodity-linked FX." },
  { id: "e10", time: "23:50", flag: "\u{1F1EF}\u{1F1F5}", currency: "JPY", title: "Industrial Production (MoM)", impact: "Medium", actual: "", forecast: "-0.4%", previous: "1.1%", affects: "USD/JPY",
    detail: "Late-session print that sets the tone for the Tokyo open rather than moving price immediately." },
];

export const CALENDAR_CURRENCIES = ["All", "USD", "EUR", "GBP", "JPY", "CAD"] as const;

export interface Post {
  id: string;
  author: string;
  initials: string;
  flag: string;
  country: string;
  role: string;
  verified: boolean;
  time: string;
  body: string;
  likes: number;
  comments: number;
  tag?: string;
}

export const POSTS: Post[] = [
  {
    id: "p1",
    author: "Maria Santos",
    initials: "MS",
    flag: "\u{1F1F5}\u{1F1ED}",
    country: "Philippines",
    role: "Pro Trader",
    verified: true,
    time: "12m",
    body: "EUR/USD approaching resistance zone. Watching London/NY overlap.",
    likes: 24,
    comments: 8,
    tag: "Analysis",
  },
  {
    id: "p2",
    author: "Ahmed K.",
    initials: "AK",
    flag: "\u{1F1E6}\u{1F1EA}",
    country: "UAE",
    role: "Member",
    verified: false,
    time: "38m",
    body: "Anyone watching XAU/USD today? Huge volatility expected.",
    likes: 11,
    comments: 17,
  },
];

export interface LeaderRow {
  rank: number;
  trader: string;
  country: string;
  flag: string;
  reputation: number;
}

export const LEADERBOARD: LeaderRow[] = [
  { rank: 1, trader: "TraderX", country: "UK", flag: "\u{1F1EC}\u{1F1E7}", reputation: 9842 },
  { rank: 2, trader: "FXMaster", country: "SG", flag: "\u{1F1F8}\u{1F1EC}", reputation: 9210 },
  { rank: 3, trader: "MarketPro", country: "UAE", flag: "\u{1F1E6}\u{1F1EA}", reputation: 8921 },
  { rank: 4, trader: "SakuraFX", country: "JP", flag: "\u{1F1EF}\u{1F1F5}", reputation: 8540 },
  { rank: 5, trader: "PinoyTrader", country: "PH", flag: "\u{1F1F5}\u{1F1ED}", reputation: 8210 },
];

export const MEMBERSHIP_BENEFITS = [
  "Advanced Market Intelligence",
  "AI Tools",
  "Premium Education",
  "Exclusive Community",
  "Events & Challenges",
];

export const DISCLAIMER =
  "Trading forex involves substantial risk and is not suitable for every investor. Leverage can work against you as easily as it works for you. GLOBAL FX ALLIANCE publishes education, research and community commentary only — nothing on this platform constitutes financial advice, a solicitation, or a recommendation to buy or sell any instrument. Past performance is not indicative of future results.";

export interface Chapter {
  code: string;
  name: string;
  hub: string;
  flag: string;
  members: string;
  growth: string;
}

/** Chapter cards on the landing page (#chapters-preview). */
export const CHAPTERS: Chapter[] = [
  { code: "PH", name: "Philippines", hub: "Manila", flag: "\u{1F1F5}\u{1F1ED}", members: "3,120", growth: "+18%" },
  { code: "AE", name: "UAE", hub: "Dubai", flag: "\u{1F1E6}\u{1F1EA}", members: "1,840", growth: "+24%" },
  { code: "SG", name: "Singapore", hub: "Singapore", flag: "\u{1F1F8}\u{1F1EC}", members: "1,460", growth: "+12%" },
  { code: "GB", name: "United Kingdom", hub: "London", flag: "\u{1F1EC}\u{1F1E7}", members: "2,270", growth: "+9%" },
  { code: "US", name: "United States", hub: "New York", flag: "\u{1F1FA}\u{1F1F8}", members: "2,905", growth: "+15%" },
];

export interface Course {
  title: string;
  level: "Foundation" | "Intermediate" | "Advanced";
  blurb: string;
  lessons: number;
  hours: string;
}

/** Academy tracks on the landing page (#academy-preview). */
export const COURSES: Course[] = [
  {
    title: "Forex Fundamentals",
    level: "Foundation",
    blurb:
      "How the market actually works — pairs, pips, leverage, sessions and order types — before a single position goes on.",
    lessons: 24,
    hours: "6h",
  },
  {
    title: "Technical Mastery",
    level: "Intermediate",
    blurb:
      "Structure, liquidity and confluence. Reading a chart the way a desk reads it, and building a setup you can repeat.",
    lessons: 31,
    hours: "9h",
  },
  {
    title: "Risk & Psychology",
    level: "Advanced",
    blurb:
      "Position sizing, drawdown control and the discipline that separates a strategy on paper from one that survives.",
    lessons: 18,
    hours: "5h",
  },
];

export interface Article {
  title: string;
  category: string;
  excerpt: string;
  date: string;
  readTime: string;
}

/** Blog teasers on the landing page (#blog-preview). */
export const ARTICLES: Article[] = [
  {
    title: "Why the London/New York overlap still sets the day",
    category: "Market Structure",
    excerpt:
      "Four hours a day carry a disproportionate share of the volume. Here is what that concentration does to spreads, and how members plan around it.",
    date: "Aug 28, 2026",
    readTime: "6 min",
  },
  {
    title: "Reading dollar strength without reading the dollar",
    category: "Macro",
    excerpt:
      "EUR/USD rallies are not always euro demand. A short guide to separating the two sides of a quote before you call a trend.",
    date: "Aug 24, 2026",
    readTime: "8 min",
  },
  {
    title: "What we ask our AI, and what we never ask it",
    category: "AI & Tooling",
    excerpt:
      "Market intelligence tools are good at context and bad at conviction. Where the Alliance draws that line, and why.",
    date: "Aug 19, 2026",
    readTime: "5 min",
  },
];
