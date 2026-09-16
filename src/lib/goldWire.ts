/**
 * Gold wire classifier — which headlines bear on XAU/USD, which way, and why.
 *
 * Rule-based, not a model. Every read below can be traced to the words that
 * triggered it, which matters more here than fluency: a wire that tells a
 * member "bearish for gold" needs to be checkable, and a language model asked
 * the same question twice will not always give the same answer.
 *
 * Direction is for GOLD, not for the headline's subject. "Dollar rallies" is a
 * bullish headline for the dollar and a bearish one for gold; the generic
 * sentiment the rest of the news tab uses cannot tell those apart.
 */

export type GoldTag = "Gold" | "Fed" | "DXY" | "Yields" | "Data" | "Geo";
export type GoldBias = "bullish" | "bearish" | "neutral";
export type Impact = "HIGH" | "MEDIUM" | "LOW";

export interface GoldRead {
  relevant: boolean;
  tags: GoldTag[];
  bias: GoldBias;
  impact: Impact;
  /** One line: the transmission from this headline to the gold price. */
  why: string;
  /** Which rule produced `bias`, for the audit trail. */
  driver: GoldTag | null;
}

const has = (re: RegExp, t: string) => re.test(t);

/* ------------------------------------------------------------------ terms */

const GOLD = /\b(gold|xau(?:\/?usd)?|bullion|precious metals?)\b/i;
const FED = /\b(fed|fomc|powell|warsh|federal reserve|rate decision|dot plot|rate (?:hike|cut)s?|hik(?:e|es|ing) rates?|cut(?:s|ting)? rates?)\b/i;
const DXY = /\b(dxy|us dollar index|dollar index|us dollar|u\.s\. dollar|greenback|usd)\b/i;
const YIELDS = /\b(treasur(?:y|ies)|yields?|10-year|10y|us10y|bond market|real rates?)\b/i;
const DATA = /\b(cpi|pce|core pce|payrolls|nfp|nonfarm|jobs report|jobless claims|unemployment rate|inflation|gdp|retail sales|ism|pmi)\b/i;
const GEO = /\b(war|conflict|mideast|middle east|missiles?|strikes?|sanctions|geopolitic\w*|safe[- ]haven|invasion|ceasefire|risk[- ]off|tensions?)\b/i;

/**
 * Stories whose subject is another market. A headline about the Pound "ahead
 * of a Fed hike" mentions the Fed, but it is a sterling story; letting the Fed
 * term pull it in filled the gold wire with FX and equity round-ups. These are
 * only excluded when gold itself is not named.
 */
const OTHER_SUBJECT = /\b(pound|sterling|gbp|euro(?!pe)|eur\/|yen|jpy|yuan|renminbi|aussie|aud|kiwi|nzd|new zealand dollar|australian dollar|canadian dollar|loonie|cad|franc|chf|dow|dow jones|s&p|nasdaq|stocks?|equit(?:y|ies)|shares|earnings|bitcoin|btc|ether(?:eum)?|crypto|oil|crude|brent|wti|natural gas|copper|silver|nikkei|dax|ftse|hang seng)\b/i;

/* -------------------------------------------------------------- direction */

const UP = /\b(ris(?:e|es|ing)|rall(?:y|ies|ied)|gains?|climbs?|jumps?|surg(?:e|es|ing)|soars?|record|highs?|higher|advances?|rebounds?|bid|firm(?:s|er)?|extends? gains|defends?|holds? above|breaks? above)\b/i;
const DOWN = /\b(fall(?:s|ing)?|drops?|slid(?:e|es)|slips?|tumbl(?:e|es)|sinks?|plung(?:e|es)|lower|declines?|retreats?|los(?:e|es)|weak(?:er|ens)?|under pressure|set to fall|breaks? below|cracks? below|thin ice|offered)\b/i;
const HAWK = /\b(hawkish|hike|hikes|hiking|tighten\w*|higher for longer|rate-hike)\b/i;
const DOVE = /\b(dovish|cut|cuts|cutting|eas(?:e|ing)|pause|pivot)\b/i;
const HOT = /\b(hot|hotter|beats?|above (?:forecast|expectations|estimates)|accelerat\w*|jumps?|surges?|strong(?:er)?)\b/i;
const SOFT = /\b(cool(?:s|ing|er)?|soft(?:er)?|miss(?:es)?|below (?:forecast|expectations|estimates)|slow(?:s|ing|er)?|weak(?:er)?|decelerat\w*)\b/i;

const BIG = /\b(record|plung\w*|surg\w*|soar\w*|crash\w*|all-time|rate decision|fomc (?:statement|decision)|nonfarm|payrolls|cpi|core pce|war|invasion)\b/i;

/* ----------------------------------------------------------------- reason */

const WHY: Record<string, string> = {
  "Gold:bullish": "Direct bid in gold itself — price action, not a second-order driver.",
  "Gold:bearish": "Direct selling in gold itself — price action, not a second-order driver.",
  "Gold:neutral": "Gold-specific, but no clear direction in the headline — watch the levels it names.",
  "Fed:bearish": "Hawkish Fed lifts real yields and the dollar — both raise the cost of holding non-yielding gold.",
  "Fed:bullish": "Dovish Fed lowers real yields and softens the dollar — both cut the cost of holding gold.",
  "Fed:neutral": "Fed event risk — gold usually moves with the reaction in real yields, not the decision itself.",
  "Data:bearish": "Hot US data raises rate-hike odds, lifting yields and the dollar against gold.",
  "Data:bullish": "Soft US data raises rate-cut odds, pulling yields and the dollar lower — supportive for gold.",
  "Data:neutral": "US data release — gold's reaction follows what it does to rate expectations.",
  "Yields:bearish": "Rising Treasury yields increase the opportunity cost of holding gold.",
  "Yields:bullish": "Falling Treasury yields reduce the opportunity cost of holding gold.",
  "Yields:neutral": "Yields in focus — gold tends to move inversely to real rates.",
  "DXY:bearish": "Stronger dollar makes dollar-priced gold dearer for everyone else.",
  "DXY:bullish": "Weaker dollar makes dollar-priced gold cheaper abroad and lifts demand.",
  "DXY:neutral": "Dollar in focus — gold usually trades inversely to the DXY.",
  "Geo:bullish": "Geopolitical risk drives safe-haven demand into gold.",
  "Geo:bearish": "Easing geopolitical risk unwinds safe-haven demand for gold.",
  "Geo:neutral": "Geopolitical headline — safe-haven flows into gold if it escalates.",
};

/* ------------------------------------------------------------------- read */

export function classifyGold(title: string, body = ""): GoldRead {
  const t = title;
  const direct = has(GOLD, t) || (!t.trim() ? false : has(GOLD, body) && !has(OTHER_SUBJECT, t) && /\bgold\b/i.test(body.slice(0, 160)));

  const tags: GoldTag[] = [];
  if (has(GOLD, t) || direct) tags.push("Gold");
  if (has(FED, t)) tags.push("Fed");
  if (has(DATA, t)) tags.push("Data");
  if (has(YIELDS, t)) tags.push("Yields");
  if (has(DXY, t)) tags.push("DXY");
  if (has(GEO, t)) tags.push("Geo");

  const relevant = tags.includes("Gold") || (tags.length > 0 && !has(OTHER_SUBJECT, t));
  if (!relevant) return { relevant: false, tags: [], bias: "neutral", impact: "LOW", why: "", driver: null };

  // Priority: gold's own price action, then the policy driver, then data,
  // yields, the dollar, and geopolitics. The first one with a direction wins;
  // a headline naming two drivers is read by the one closest to gold.
  let bias: GoldBias = "neutral";
  let driver: GoldTag | null = null;

  const pick = (tag: GoldTag, dir: GoldBias) => {
    if (driver === null && dir !== "neutral") { bias = dir; driver = tag; }
  };

  /*
   * Direction is read from the clause that names the driver, not the whole
   * headline. "As yields/USD move higher, gold is falling sharply" carries both
   * an up word and a down word; read whole, they cancel to neutral. Split, the
   * gold clause says falling and the yields clause says higher — which agree:
   * both are bearish for gold.
   */
  // Not split on ":" (it joins a speaker to what they said — "Powell: hawkish
  // hold") or on a comma inside a number ("$4,275"), or on "on", which sits
  // inside phrases ("skating on thin ice") far more often than between clauses.
  const clauses = t.split(/,(?!\d)|[.;|–—](?!\d)|\s(?:as|while|after|amid|ahead of|but|despite)\s/i).map((c) => c.trim()).filter(Boolean);
  const about = (re: RegExp) => clauses.filter((c) => re.test(c)).join(" ") || t;
  const dir = (text: string, upMeans: GoldBias, downMeans: GoldBias): GoldBias => {
    const up = has(UP, text), down = has(DOWN, text);
    return up && !down ? upMeans : down && !up ? downMeans : "neutral";
  };

  if (tags.includes("Gold")) pick("Gold", dir(about(GOLD), "bullish", "bearish"));
  if (tags.includes("Fed")) {
    const c = about(FED);
    pick("Fed", has(HAWK, c) && !has(DOVE, c) ? "bearish" : has(DOVE, c) && !has(HAWK, c) ? "bullish" : "neutral");
  }
  if (tags.includes("Data")) {
    const c = about(DATA);
    pick("Data", has(HOT, c) && !has(SOFT, c) ? "bearish" : has(SOFT, c) && !has(HOT, c) ? "bullish" : "neutral");
  }
  // Yields and the dollar move inversely to gold: up is bearish.
  if (tags.includes("Yields")) pick("Yields", dir(about(YIELDS), "bearish", "bullish"));
  if (tags.includes("DXY")) pick("DXY", dir(about(DXY), "bearish", "bullish"));
  if (tags.includes("Geo")) pick("Geo", /\b(ceasefire|de-?escalat\w*|truce|peace)\b/i.test(t) ? "bearish" : "bullish");

  const lead: GoldTag = driver ?? tags[0];
  const impact: Impact =
    has(BIG, t) || (lead === "Fed" && /\b(decision|statement|verdict|hikes?|cuts?)\b/i.test(t)) ? "HIGH"
    : tags.includes("Gold") || lead === "Fed" || lead === "Data" ? "MEDIUM"
    : "LOW";

  return { relevant: true, tags, bias, impact, why: WHY[`${lead}:${bias}`] ?? WHY[`${lead}:neutral`], driver };
}

/** Normalised title for de-duplicating the same story across feeds. */
export function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** "14:32" in Dubai. */
export function dubaiClock(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });
}
