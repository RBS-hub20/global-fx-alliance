/**
 * Stable pseudonym for a member.
 *
 * The shoutbox and leaderboard are public surfaces, so they must not carry email
 * addresses. Masking to `renz***@gmail.com` is not enough — in a community this
 * size the prefix and domain identify a person, and it hands anyone the string
 * they would need to impersonate them. A derived handle is stable per address,
 * reveals nothing about it, and is the same everywhere it appears.
 */
export function handleFor(email: string): string {
  const norm = email.trim().toLowerCase();
  // FNV-1a: short, deterministic, and enough for a display name.
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `trader-${h.toString(36).padStart(6, "0").slice(-6)}`;
}
