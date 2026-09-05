/**
 * Official social accounts.
 *
 * Every URL comes from the environment and nothing is hard-coded. The previous
 * list guessed handles — `facebook.com/globalfxalliance` and friends — and
 * shipped them as live links. If one of those handles belongs to somebody else,
 * the site is sending members to a stranger under the Alliance's name, which is
 * exactly how an impersonation account gets an audience.
 *
 * Two accounts now carry a default because the owner confirmed them directly —
 * Facebook, and Telegram at `t.me/GFXAlliance` (the earlier guess pointed at
 * `t.me/globalfxalliance`, which was wrong). Everything else still appears only
 * once its real URL is set: unset means hidden, not broken, because a missing
 * social row costs nothing and a wrong one costs trust.
 *
 * An env var always wins over a default, so a handle can be changed in Vercel
 * without a deploy.
 *
 * Set in Vercel → Settings → Environment Variables (they are NEXT_PUBLIC_
 * because the browser renders them):
 *   NEXT_PUBLIC_FB_PAGE_URL, NEXT_PUBLIC_TIKTOK_URL, NEXT_PUBLIC_TELEGRAM_URL,
 *   NEXT_PUBLIC_TELEGRAM_CHAT_URL, NEXT_PUBLIC_YOUTUBE_URL,
 *   NEXT_PUBLIC_INSTAGRAM_URL, NEXT_PUBLIC_X_URL
 */

export type SocialId =
  | "facebook" | "tiktok" | "telegram" | "telegramChat"
  | "youtube" | "instagram" | "x";

export interface Social {
  id: SocialId;
  label: string;
  /** What the channel is for, in the reader's terms. */
  blurb: string;
  url: string;
  handle: string;
  /** The platform's own colour, for hover on the footer buttons. */
  color: string;
}

/** Only http(s), and never a bare placeholder that slipped into the env. */
function clean(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  // Rejects a half-filled env var anywhere in the value, not just at the start:
  // "https://example.com/set_your_url" is no more usable than the bare token.
  if (!v || /(set_your|your_url|placeholder|example\.com)/i.test(v) || /^(set_|your_)/i.test(v)) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** "@name" from the last meaningful path segment, for display next to the icon. */
function handleFrom(url: string, fallback: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) return fallback;
    return last.startsWith("@") ? last : `@${last}`;
  } catch {
    return fallback;
  }
}

interface Def {
  id: SocialId;
  label: string;
  blurb: string;
  color: string;
  env: string | undefined;
  /** Owner-confirmed URL, used when no env var is set. */
  confirmed?: string;
}

const DEFS: Def[] = [
  {
    id: "facebook", label: "Facebook", blurb: "Page updates and community posts", color: "#1877F2",
    env: process.env.NEXT_PUBLIC_FB_PAGE_URL,
    confirmed: "https://www.facebook.com/globalfxalliance",
  },
  {
    id: "telegram", label: "Telegram channel", blurb: "Analysis and session notes", color: "#26A5E4",
    env: process.env.NEXT_PUBLIC_TELEGRAM_URL,
    confirmed: "https://t.me/GFXAlliance",
  },
  { id: "tiktok", label: "TikTok", blurb: "Short daily market breakdowns", color: "#FE2C55", env: process.env.NEXT_PUBLIC_TIKTOK_URL },
  { id: "youtube", label: "YouTube", blurb: "Longer walkthroughs", color: "#FF0000", env: process.env.NEXT_PUBLIC_YOUTUBE_URL },
  { id: "telegramChat", label: "Telegram chat", blurb: "Where members talk to each other", color: "#26A5E4", env: process.env.NEXT_PUBLIC_TELEGRAM_CHAT_URL },
  { id: "instagram", label: "Instagram", blurb: "Chart posts and chapter photos", color: "#E4405F", env: process.env.NEXT_PUBLIC_INSTAGRAM_URL },
  { id: "x", label: "X", blurb: "Headlines as they land", color: "#FFFFFF", env: process.env.NEXT_PUBLIC_X_URL },
];

export const SOCIALS: Social[] = DEFS.flatMap((d) => {
  // Env wins, so a handle can change in Vercel without a deploy; the confirmed
  // default carries the two accounts the owner has verified.
  const url = clean(d.env) ?? d.confirmed ?? null;
  return url
    ? [{ id: d.id, label: d.label, blurb: d.blurb, color: d.color, url, handle: handleFrom(url, d.label) }]
    : [];
});

export const hasSocials = SOCIALS.length > 0;
