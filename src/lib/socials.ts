/**
 * Official social accounts.
 *
 * Every URL comes from the environment and nothing is hard-coded. The previous
 * list guessed handles — `facebook.com/globalfxalliance` and friends — and
 * shipped them as live links. If one of those handles belongs to somebody else,
 * the site is sending members to a stranger under the Alliance's name, which is
 * exactly how an impersonation account gets an audience.
 *
 * So an account appears only once its real URL is set. Unset means hidden, not
 * broken: a missing social row costs nothing, a wrong one costs trust.
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
}

/** Only http(s), and never a bare placeholder that slipped into the env. */
function clean(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || /^(set_|your_|placeholder)/i.test(v)) return null;
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

const DEFS: { id: SocialId; label: string; blurb: string; env: string | undefined }[] = [
  { id: "facebook", label: "Facebook", blurb: "Page updates and community posts", env: process.env.NEXT_PUBLIC_FB_PAGE_URL },
  { id: "tiktok", label: "TikTok", blurb: "Short daily market breakdowns", env: process.env.NEXT_PUBLIC_TIKTOK_URL },
  { id: "telegram", label: "Telegram channel", blurb: "Analysis and session notes", env: process.env.NEXT_PUBLIC_TELEGRAM_URL },
  { id: "telegramChat", label: "Telegram chat", blurb: "Where members talk to each other", env: process.env.NEXT_PUBLIC_TELEGRAM_CHAT_URL },
  { id: "youtube", label: "YouTube", blurb: "Longer walkthroughs", env: process.env.NEXT_PUBLIC_YOUTUBE_URL },
  { id: "instagram", label: "Instagram", blurb: "Chart posts and chapter photos", env: process.env.NEXT_PUBLIC_INSTAGRAM_URL },
  { id: "x", label: "X", blurb: "Headlines as they land", env: process.env.NEXT_PUBLIC_X_URL },
];

export const SOCIALS: Social[] = DEFS.flatMap((d) => {
  const url = clean(d.env);
  return url ? [{ id: d.id, label: d.label, blurb: d.blurb, url, handle: handleFrom(url, d.label) }] : [];
});

export const hasSocials = SOCIALS.length > 0;
