"use client";

/**
 * The member's email, shared with the verification gate.
 *
 * One key, so someone who submitted for verification does not have to type their
 * address again to check in, and the streak lines up with the account that gets
 * approved. Not an identity system — see the note on the streak route.
 */

const EMAIL_KEY = "gfxa-ib-email";

export function getMemberEmail(): string {
  try {
    return window.localStorage.getItem(EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setMemberEmail(email: string): void {
  try {
    window.localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    /* private mode */
  }
}
