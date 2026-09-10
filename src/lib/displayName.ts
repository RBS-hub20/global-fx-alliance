/**
 * How a member is named on screen.
 *
 * The bug this replaces: every profile, every post author and the header avatar
 * read from `PROFILE` in content.ts — a fixture holding one real person's name
 * and initials. It was never per-account, so it could not have been right for
 * anyone but that one account.
 *
 * Order of preference: what the member typed, then what can be read off their
 * address, then a neutral word. Never another member's name.
 */

export interface NameSource {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

/** Leaves an all-caps token alone — "AF" should not become "Af". */
function titleCase(word: string): string {
  if (!word) return "";
  if (word.length <= 4 && word === word.toUpperCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * A readable label from the local part of an address.
 *
 * Separators are the only word boundaries trusted here: "renmar.sombilon"
 * becomes "Renmar Sombilon", but "afhomesresort" stays "Afhomesresort" rather
 * than being split into "AF Homes Resort". Splitting a run of letters into
 * words needs a dictionary, and a wrong guess ("Ren Zsom", "Mark Etting") is
 * printed next to a real person's account. The fix for an ugly fallback is the
 * name field on the form, not a cleverer guess.
 *
 * Trailing digits go — they are almost always a year or a disambiguator, not
 * part of a name.
 */
export function nameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = (email.split("@")[0] ?? "").trim();
  if (!local) return null;

  const words = local
    .replace(/\d+$/, "")
    .split(/[._\-+]+/)
    .map((w) => w.replace(/[^a-z]/gi, ""))
    .filter((w) => w.length > 0)
    .map(titleCase);

  return words.length ? words.join(" ") : null;
}

/** Full name for headers, cards and post authorship. */
export function displayName(p: NameSource | null | undefined, fallback = "Trader"): string {
  const typed = p?.display_name?.trim();
  if (typed) return typed;

  const parts = [p?.first_name?.trim(), p?.last_name?.trim()].filter(Boolean);
  if (parts.length) return parts.join(" ");

  return nameFromEmail(p?.email) ?? fallback;
}

/** One word, for "Good afternoon, ___." */
export function firstName(p: NameSource | null | undefined, fallback = "Trader"): string {
  const typed = p?.first_name?.trim();
  if (typed) return typed;

  const full = displayName(p, fallback);
  return full.split(/\s+/)[0] || fallback;
}

/** Up to two letters for the avatar. */
export function initials(p: NameSource | null | undefined, fallback = "GF"): string {
  const full = displayName(p, "");
  const letters = full
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase());

  if (letters.length >= 2) return letters[0] + letters[letters.length - 1];
  if (letters.length === 1) return full.slice(0, 2).toUpperCase();

  const local = (p?.email ?? "").split("@")[0];
  return local ? local.slice(0, 2).toUpperCase() : fallback;
}

/** Splits one typed field into the two columns, so "Renmar Sombilon" stores both. */
export function splitName(input: string): { display_name: string; first_name: string; last_name: string | null } {
  const clean = input.trim().replace(/\s+/g, " ");
  const parts = clean.split(" ");
  return {
    display_name: clean,
    first_name: parts[0] ?? "",
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}
