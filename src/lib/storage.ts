"use client";

import { useEffect, useRef, useState } from "react";

/**
 * localStorage helpers.
 *
 * Every access is guarded: storage throws in private mode, when a browser
 * blocks site data, and during SSR where it does not exist at all. Reads always
 * fall back to the supplied default rather than crashing the panel.
 */

export const KEYS = {
  watchlist: "gfxa-watchlist",
  journal: "gfxa-journal",
  academy: "gfxa-academy",
  chat: "gfxa-chat",
  chapters: "gfxa-chapters",
  settings: "gfxa-settings",
  challenges: "gfxa-challenges",
  likes: "gfxa-likes",
} as const;

export function readStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStore(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * State persisted to localStorage.
 *
 * The first render always returns `initial` so server and client markup match;
 * the stored value is loaded in an effect immediately after mount. `hydrated`
 * lets callers hold back an empty state until the real value has arrived, so a
 * populated watchlist never flashes "nothing here yet".
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initial);

  // Load once on mount. The first render must return `initial` unchanged so the
  // server and client markup agree.
  useEffect(() => {
    setValue(readStore<T>(key, initialRef.current));
    setHydrated(true);
  }, [key]);

  // Persist on change — but only once the stored value has actually landed in
  // state. Gating on `hydrated` (state, not a ref) is what makes this safe: a
  // ref flipped inside the load effect is already true when this effect runs in
  // the same commit, so it would write the *default* back over real saved data
  // on every mount.
  useEffect(() => {
    if (!hydrated) return;
    writeStore(key, value);
  }, [key, value, hydrated]);

  return { value, setValue, hydrated } as const;
}
