/** Editorial + community mock content for the dashboard panels. */

export type Sentiment = "Bullish" | "Bearish" | "Neutral";

export interface NewsItem {
  id: string;
  time: string;
  source: string;
  category: "Forex" | "Gold" | "Central Banks" | "Economy";
  title: string;
  summary: string;
  body: string;
  tags: string[];
  sentiment: Sentiment;
  affects: string;
}

export const NEWS: NewsItem[] = [
  {
    id: "n1", time: "2h ago", source: "Bloomberg", category: "Central Banks",
    title: "Fed signals pause in rate hikes — USD weakens across the board",
    summary:
      "Minutes from the July meeting show a committee comfortable holding through year-end, with two members flagging cuts if payrolls soften further.",
    body:
      "The dollar index gave back most of the week's gains within an hour of the release. The language traders keyed on was the shift from \"additional firming may be appropriate\" to \"the committee will assess incoming data\" — a phrasing change that removes the built-in hiking bias. Rate futures now price roughly a 70% chance of no move at the next meeting. For EUR/USD, this removes the main headwind that capped the pair below 1.1750 for most of August.",
    tags: ["USD", "Fed", "Rates"], sentiment: "Bullish", affects: "EUR/USD",
  },
  {
    id: "n2", time: "3h ago", source: "Reuters", category: "Gold",
    title: "Gold extends run to 2,650 as real yields slip",
    summary:
      "Bullion is up for a fifth straight session, tracking a fall in 10-year TIPS yields rather than any fresh haven bid.",
    body:
      "The move has been orderly and yield-driven, which is what separates it from a panic bid. Ten-year real yields have fallen about 18bp this week; gold's beta to that move has been unusually tight. Positioning data suggests the leveraged funds net long is now at its highest since March, which is the main argument for caution — crowded is not the same as wrong, but it does change how a reversal would behave.",
    tags: ["XAU", "Yields", "Metals"], sentiment: "Bullish", affects: "XAU/USD",
  },
  {
    id: "n3", time: "5h ago", source: "Financial Times", category: "Central Banks",
    title: "ECB officials push back on early-cut expectations",
    summary:
      "Two governing council members used morning appearances to argue that services inflation has not yet cooled enough to justify easing.",
    body:
      "This is the second week running that the hawkish wing has spoken publicly ahead of the blackout period. The euro's reaction was modest but persistent — a slow grind higher rather than a spike, which typically signals repositioning rather than speculative flow. Watch the 1.1760 area: it has capped the pair twice this month and a close above it would be the first higher high since June.",
    tags: ["EUR", "ECB", "Inflation"], sentiment: "Bullish", affects: "EUR/USD",
  },
  {
    id: "n4", time: "6h ago", source: "Bloomberg", category: "Forex",
    title: "Sterling slips as UK retail sales miss badly",
    summary:
      "Volumes fell 0.6% on the month against expectations of a small gain, the weakest print since January.",
    body:
      "Cable sold off about 40 pips on the release and has not recovered. The miss was broad rather than concentrated in one category, which makes it harder to dismiss as noise. GBP/USD is now trading below its 20-day average for the first time in three weeks, and EUR/GBP has broken out of the range it held through August.",
    tags: ["GBP", "Retail", "UK"], sentiment: "Bearish", affects: "GBP/USD",
  },
  {
    id: "n5", time: "8h ago", source: "Nikkei", category: "Forex",
    title: "Yen stays pinned near 147 as BoJ holds policy steady",
    summary:
      "No change to the target rate and no adjustment to yield curve control, leaving the carry differential intact.",
    body:
      "The statement was almost identical to the previous one, and the yen's lack of reaction says the market had fully priced it. USD/JPY continues to trade on US yields rather than anything domestic. Intervention risk is the live question — previous rounds came around 150, and officials have started using the word \"excessive\" again.",
    tags: ["JPY", "BoJ", "Carry"], sentiment: "Neutral", affects: "USD/JPY",
  },
  {
    id: "n6", time: "11h ago", source: "Reuters", category: "Economy",
    title: "US core PCE cools to 2.6%, softest since early 2021",
    summary:
      "The Fed's preferred inflation gauge undershot consensus, reinforcing the case for a hold at the next meeting.",
    body:
      "Both the headline and core measures came in a tenth below forecast. The three-month annualised rate — the number policymakers have said they watch most closely — is now comfortably below 3%. Dollar softness after the print was broad-based, showing up against every G10 currency rather than being concentrated in one pair.",
    tags: ["USD", "Inflation", "PCE"], sentiment: "Bearish", affects: "USD/CHF",
  },
  {
    id: "n7", time: "14h ago", source: "AFR", category: "Forex",
    title: "Aussie firms on stronger-than-expected China PMI",
    summary:
      "Manufacturing returned to expansion for the first time in five months, lifting the growth-sensitive currencies.",
    body:
      "AUD/USD and NZD/USD both caught a bid, though the Aussie has held its gains better. The read-through is mechanical: China manufacturing drives iron ore demand, which drives Australia's terms of trade. One month does not make a trend, and the sub-indices were less convincing than the headline.",
    tags: ["AUD", "China", "PMI"], sentiment: "Bullish", affects: "AUD/USD",
  },
  {
    id: "n8", time: "16h ago", source: "Bloomberg", category: "Central Banks",
    title: "SNB signals comfort with a stronger franc",
    summary:
      "Officials dropped the long-standing reference to the currency being 'highly valued' in prepared remarks.",
    body:
      "A small wording change with real consequences: it has historically preceded a period of reduced intervention. USD/CHF has been drifting lower for three weeks and this removes one of the arguments for a bounce. The pair is now well below its 200-day average.",
    tags: ["CHF", "SNB"], sentiment: "Bearish", affects: "USD/CHF",
  },
  {
    id: "n9", time: "19h ago", source: "Reuters", category: "Gold",
    title: "Central bank gold buying stays elevated in Q2",
    summary:
      "Official-sector demand ran above the five-year average again, led by emerging-market reserve managers.",
    body:
      "This is the slow-moving bid underneath the price. It does not drive day-to-day moves, but it changes the character of dips: sustained official buying has historically shortened the duration of corrections rather than preventing them.",
    tags: ["XAU", "Reserves"], sentiment: "Bullish", affects: "XAU/USD",
  },
  {
    id: "n10", time: "22h ago", source: "Financial Times", category: "Economy",
    title: "Eurozone composite PMI edges back above 50",
    summary:
      "Services carried the index while manufacturing stayed in contraction for a fourteenth month.",
    body:
      "A marginal expansion, and the internals remain lopsided. Still, the direction of travel matters for a currency that spent the first half of the year priced for stagnation. Combined with the ECB pushback on cuts, it is the more constructive of the two euro stories this week.",
    tags: ["EUR", "PMI", "Growth"], sentiment: "Bullish", affects: "EUR/USD",
  },
];

export const NEWS_FILTERS = ["All", "Forex", "Gold", "Central Banks", "Economy"] as const;

export interface Thread {
  id: string;
  title: string;
  author: string;
  initials: string;
  flag: string;
  body: string;
  replies: number;
  views: string;
  activity: string;
  tags: string[];
  answers: { author: string; initials: string; time: string; body: string }[];
}

export const THREADS: Thread[] = [
  {
    id: "t1", title: "Is EUR/USD heading to 1.20?", author: "Maria Santos", initials: "MS",
    flag: "\u{1F1F5}\u{1F1ED}",
    body: "We've taken out the August highs and the dollar story has flipped. But every rally this year has stalled around the 1.1750–1.1800 shelf. What would actually need to happen for 1.20 to be on the table rather than just a round number people like saying?",
    replies: 24, views: "1.2k", activity: "5m ago", tags: ["EUR/USD", "Technical"],
    answers: [
      { author: "TraderX", initials: "TX", time: "12m ago", body: "1.20 needs a rate differential story, not a technical one. Until the front end of the curve moves you're asking spot to do all the work." },
      { author: "Ahmed K.", initials: "AK", time: "38m ago", body: "Agree on levels. I'd add that the last two attempts both failed on thin European afternoons — the failures had no volume behind them, which makes them less meaningful than the chart suggests." },
      { author: "SakuraFX", initials: "SF", time: "1h ago", body: "Watch EUR/GBP. If the euro strength is real it should show up on the crosses first, and it has been." },
    ],
  },
  {
    id: "t2", title: "How do you size positions around high-impact news?", author: "PinoyTrader", initials: "PT",
    flag: "\u{1F1F5}\u{1F1ED}",
    body: "I keep getting stopped out by the spike and then watching price go exactly where I thought. Do you cut size and widen stops, stand aside entirely, or something else?",
    replies: 41, views: "3.4k", activity: "22m ago", tags: ["Risk", "Education"],
    answers: [
      { author: "MarketPro", initials: "MP", time: "30m ago", body: "Standing aside is a position. If your edge doesn't come from the release, being flat through it costs you nothing and saves you the spread blowout." },
      { author: "FXMaster", initials: "FM", time: "1h ago", body: "Half size, stop outside the expected range from the options market, and accept fewer fills. The mistake is keeping full size and just hoping." },
    ],
  },
  {
    id: "t3", title: "Gold at 2650 — chasing or waiting for the pullback?", author: "MarketPro", initials: "MP",
    flag: "\u{1F1E6}\u{1F1EA}",
    body: "Five green sessions in a row and RSI is at 72. Historically that's been a decent place to get hurt, but the yield story genuinely supports it. Curious how people are handling it.",
    replies: 33, views: "2.1k", activity: "1h ago", tags: ["XAU/USD", "Analysis"],
    answers: [
      { author: "TraderX", initials: "TX", time: "45m ago", body: "Overbought in a trend just means trending. I'd rather scale than pick a top." },
      { author: "Maria Santos", initials: "MS", time: "2h ago", body: "Waiting for a retest of 2610. If it doesn't come, I miss it. That's fine — missing a trade costs nothing." },
    ],
  },
  {
    id: "t4", title: "What actually goes in a trading journal?", author: "SakuraFX", initials: "SF",
    flag: "\u{1F1EF}\u{1F1F5}",
    body: "I've been logging entry, exit and P/L for two months and it hasn't taught me anything. What are you recording that makes it useful?",
    replies: 58, views: "5.7k", activity: "3h ago", tags: ["Education", "Psychology"],
    answers: [
      { author: "FXMaster", initials: "FM", time: "3h ago", body: "The reason for the trade, written before entry. If you can't write it in one sentence you don't have a setup, you have an opinion." },
      { author: "MarketPro", initials: "MP", time: "4h ago", body: "And how you felt. Boredom trades and revenge trades look identical in a P/L column and completely different in a notes column." },
    ],
  },
  {
    id: "t5", title: "Best session to trade if you're in GMT+8?", author: "FXMaster", initials: "FM",
    flag: "\u{1F1F8}\u{1F1EC}",
    body: "London open is 3pm local for me which is workable, but the NY overlap runs into the night. Anyone here trading Asia session successfully instead?",
    replies: 19, views: "980", activity: "6h ago", tags: ["Sessions", "Community"],
    answers: [
      { author: "PinoyTrader", initials: "PT", time: "5h ago", body: "Tokyo works fine for the yen crosses. The mistake is trying to trade EUR/USD in Asia — the ranges are too tight to pay for the spread." },
    ],
  },
];

export interface Challenge {
  id: string;
  title: string;
  blurb: string;
  prize: string;
  ends: string;
  entrants: number;
  status: "Active" | "Judging";
  leaders: { rank: number; name: string; flag: string; score: number }[];
}

export const CHALLENGES: Challenge[] = [
  {
    id: "c1", title: "Weekly EUR/USD Analysis Challenge",
    blurb: "Post a written EUR/USD outlook for next week with your levels and the reasoning behind them. Judged on the argument, not the outcome.",
    prize: "500 Rep", ends: "3 days", entrants: 128, status: "Active",
    leaders: [
      { rank: 1, name: "TraderX", flag: "\u{1F1EC}\u{1F1E7}", score: 94 },
      { rank: 2, name: "Maria Santos", flag: "\u{1F1F5}\u{1F1ED}", score: 91 },
      { rank: 3, name: "FXMaster", flag: "\u{1F1F8}\u{1F1EC}", score: 88 },
    ],
  },
  {
    id: "c2", title: "Monthly Gold Forecast",
    blurb: "Where does XAU/USD close the month, and why? Submissions include a target, an invalidation level and a one-paragraph thesis.",
    prize: "1,000 Rep", ends: "12 days", entrants: 214, status: "Active",
    leaders: [
      { rank: 1, name: "MarketPro", flag: "\u{1F1E6}\u{1F1EA}", score: 97 },
      { rank: 2, name: "SakuraFX", flag: "\u{1F1EF}\u{1F1F5}", score: 89 },
      { rank: 3, name: "PinoyTrader", flag: "\u{1F1F5}\u{1F1ED}", score: 85 },
    ],
  },
  {
    id: "c3", title: "Risk Management Case Study",
    blurb: "Given a fixed account and a losing streak, show your sizing plan. The strongest entries explain what they would not do.",
    prize: "750 Rep", ends: "Judging", entrants: 96, status: "Judging",
    leaders: [
      { rank: 1, name: "FXMaster", flag: "\u{1F1F8}\u{1F1EC}", score: 93 },
      { rank: 2, name: "TraderX", flag: "\u{1F1EC}\u{1F1E7}", score: 90 },
      { rank: 3, name: "Ahmed K.", flag: "\u{1F1E6}\u{1F1EA}", score: 86 },
    ],
  },
];

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  summary: string;
}

export interface Track {
  id: string;
  title: string;
  level: "Foundation" | "Intermediate" | "Advanced";
  blurb: string;
  lessons: Lesson[];
}

export const TRACKS: Track[] = [
  {
    id: "fundamentals", title: "Forex Fundamentals", level: "Foundation",
    blurb: "How the market actually works, before a single position goes on.",
    lessons: [
      { id: "f1", title: "What is Forex", minutes: 8, summary: "Who trades currencies, why, and what you are actually buying when you buy a pair." },
      { id: "f2", title: "How the Market Works", minutes: 12, summary: "Interbank liquidity, brokers, and where your order really goes." },
      { id: "f3", title: "Pips, Lots and Leverage", minutes: 14, summary: "The three numbers that decide how much a move is worth to you." },
      { id: "f4", title: "Order Types", minutes: 10, summary: "Market, limit, stop and the situations each one is wrong for." },
      { id: "f5", title: "Reading a Quote", minutes: 7, summary: "Bid, ask, spread, and why the spread is your first loss on every trade." },
      { id: "f6", title: "Trading Sessions", minutes: 11, summary: "Sydney through New York, and why the overlap carries the volume." },
      { id: "f7", title: "Currency Correlations", minutes: 13, summary: "Why four 'different' positions can be one bet on the dollar." },
      { id: "f8", title: "Economic Releases", minutes: 12, summary: "Which prints move price, and which ones only look important." },
      { id: "f9", title: "Rollover and Swap", minutes: 9, summary: "What holding overnight costs, and when it pays you instead." },
      { id: "f10", title: "Broker Mechanics", minutes: 10, summary: "Execution models, slippage and requotes in plain language." },
      { id: "f11", title: "Your First Trade Plan", minutes: 15, summary: "Turning a view into an entry, an invalidation and a size." },
      { id: "f12", title: "Common Beginner Errors", minutes: 12, summary: "The handful of mistakes that account for most early account damage." },
    ],
  },
  {
    id: "technical", title: "Technical Mastery", level: "Intermediate",
    blurb: "Reading a chart the way a desk reads it, and building a setup you can repeat.",
    lessons: [
      { id: "t1", title: "Market Structure", minutes: 16, summary: "Higher highs, lower lows, and what actually counts as a break." },
      { id: "t2", title: "Support and Resistance", minutes: 14, summary: "Why levels work, and why the obvious ones work differently." },
      { id: "t3", title: "Trend Identification", minutes: 12, summary: "Separating trend from range before choosing a tool." },
      { id: "t4", title: "Candlestick Behaviour", minutes: 13, summary: "What a candle tells you about the auction that produced it." },
      { id: "t5", title: "Moving Averages", minutes: 11, summary: "Dynamic levels, crossovers, and their well-known failure mode." },
      { id: "t6", title: "RSI and Momentum", minutes: 14, summary: "Why overbought does not mean 'sell', with examples." },
      { id: "t7", title: "Liquidity and Stop Runs", minutes: 18, summary: "Where resting orders sit and why price visits them." },
      { id: "t8", title: "Multi-Timeframe Analysis", minutes: 16, summary: "Aligning a 4H thesis with a 5-minute entry." },
      { id: "t9", title: "Confluence", minutes: 13, summary: "Stacking evidence without fooling yourself into false confidence." },
      { id: "t10", title: "Chart Patterns", minutes: 15, summary: "The patterns with real base rates, and the ones without." },
      { id: "t11", title: "Volume and Participation", minutes: 12, summary: "Reading effort against result in an OTC market." },
      { id: "t12", title: "Fibonacci in Practice", minutes: 11, summary: "A measuring tool, not a prediction engine." },
      { id: "t13", title: "Range Trading", minutes: 12, summary: "Fading edges, and knowing when the range is over." },
      { id: "t14", title: "Breakout Trading", minutes: 14, summary: "Continuation versus trap, and how to tell early." },
      { id: "t15", title: "Session Strategies", minutes: 13, summary: "Setups that only make sense at certain hours." },
      { id: "t16", title: "Building a Setup", minutes: 20, summary: "Turning observations into a rule you can test." },
      { id: "t17", title: "Backtesting Honestly", minutes: 18, summary: "Sample size, curve fitting and the outcomes you ignore." },
      { id: "t18", title: "Refining Execution", minutes: 15, summary: "Cutting cost per trade without cutting the edge." },
    ],
  },
  {
    id: "risk", title: "Risk & Psychology", level: "Advanced",
    blurb: "The discipline that separates a strategy on paper from one that survives.",
    lessons: [
      { id: "r1", title: "Position Sizing Math", minutes: 16, summary: "Fixed fractional sizing, and why it is the default for a reason." },
      { id: "r2", title: "Expectancy", minutes: 14, summary: "Win rate is not edge. This is the number that is." },
      { id: "r3", title: "Drawdown Mechanics", minutes: 15, summary: "The arithmetic of recovery, and why deep holes are so expensive." },
      { id: "r4", title: "Risk of Ruin", minutes: 13, summary: "Sizing so that a bad run is survivable rather than terminal." },
      { id: "r5", title: "Correlation Risk", minutes: 12, summary: "Measuring true exposure across open positions." },
      { id: "r6", title: "The Journal That Works", minutes: 14, summary: "Recording reasoning and state, not just prices." },
      { id: "r7", title: "Tilt and Revenge Trading", minutes: 16, summary: "Spotting the state before it costs you." },
      { id: "r8", title: "Process vs Outcome", minutes: 13, summary: "Judging a good decision that lost, and a bad one that won." },
      { id: "r9", title: "Routine and Preparation", minutes: 11, summary: "What the hour before the session should look like." },
      { id: "r10", title: "Scaling Up Safely", minutes: 17, summary: "Adding size without changing the behaviour that earned it." },
    ],
  },
];

export interface Activity {
  time: string;
  text: string;
}

export const PROFILE = {
  name: "Renmar Sombilon",
  handle: "@renmar",
  role: "Pro Trader",
  flag: "\u{1F1F5}\u{1F1ED}",
  country: "Philippines",
  initials: "RS",
  bio: "Swing trader focused on the majors and gold. Mostly London session. Learning in public with the Alliance.",
  style: "Swing",
  since: "Jan 2026",
  reputation: 2480,
  tradesLogged: 47,
  analysisPosted: 12,
  activity: [
    { time: "12m ago", text: "Posted analysis on EUR/USD approaching resistance" },
    { time: "2h ago", text: "Completed lesson: Liquidity and Stop Runs" },
    { time: "5h ago", text: "Logged a closed GBP/USD short (+$142)" },
    { time: "1d ago", text: "Joined the Weekly EUR/USD Analysis Challenge" },
    { time: "2d ago", text: "Replied in \"What actually goes in a trading journal?\"" },
    { time: "3d ago", text: "Added XAU/USD to watchlist" },
  ] as Activity[],
};

export const BILLING = [
  { date: "Aug 01, 2026", plan: "GFXA Pro — Monthly", amount: 29, status: "Paid" },
  { date: "Jul 01, 2026", plan: "GFXA Pro — Monthly", amount: 29, status: "Paid" },
  { date: "Jun 01, 2026", plan: "GFXA Pro — Monthly", amount: 29, status: "Paid" },
  { date: "May 01, 2026", plan: "GFXA Pro — Monthly", amount: 29, status: "Paid" },
];
