"use client";

import { readStore, writeStore } from "./storage";

/**
 * Waitlist capture with no backend and no cost.
 *
 * Entries are kept in localStorage on the visitor's own device and POSTed to an
 * edge route that validates and rate-limits but deliberately stores nothing. The
 * device copy is what lets the UI stop nagging someone who already signed up.
 */

export const WAITLIST_KEY = "gfxa-waitlist";

export interface WaitlistEntry {
  email: string;
  at: string;
}

/** Deliberately permissive: reject the obviously-broken, not the unusual. */
export function isValidEmail(email: string): boolean {
  const v = email.trim();
  if (v.length < 6 || v.length > 254) return false;
  if (/\s/.test(v)) return false;
  const parts = v.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  if (domain.includes("..")) return false;
  return /^[^@]+@[^@]+\.[A-Za-z]{2,}$/.test(v);
}

export function getEntries(): WaitlistEntry[] {
  return readStore<WaitlistEntry[]>(WAITLIST_KEY, []);
}

export function hasJoined(): boolean {
  return getEntries().length > 0;
}

export function saveEntry(email: string): WaitlistEntry {
  const entry: WaitlistEntry = { email: email.trim().toLowerCase(), at: new Date().toISOString() };
  const existing = getEntries().filter((e) => e.email !== entry.email);
  writeStore(WAITLIST_KEY, [...existing, entry]);
  return entry;
}

/** Best-effort ping. A failed request never blocks the local signup. */
export async function submitEmail(email: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: json?.message ?? "Please try again in a moment." };
    return { ok: true };
  } catch {
    return { ok: true, message: "Saved on this device." };
  }
}
