"use client";

import { BROKERS, BROKER_INFO, isBroker, type Broker, type BrokerInfo } from "./brokers";

export { BROKERS, BROKER_INFO, isBroker };
export type { Broker, BrokerInfo };

/**
 * Partner-link attribution.
 *
 * Records which broker link a visitor arrived through and when, so an admin can
 * line that up against the broker's own IB portal later. Nothing here proves a
 * deposit — no broker in the community exposes deposits through a public partner
 * API (Vantage's IB Access API has no balance or fund-movement endpoint at all;
 * its allocationData records portfolio assignments, not money), so the click is
 * a hint for a human check, never evidence on its own.
 */

const KEY = "gfxa-ib";
const COOKIE = "gfxa_ib";
const DAYS = 30;

export interface IBInfo {
  broker: Broker;
  code: string;
  clickTime: number;
}

function writeCookie(value: string) {
  try {
    const expires = new Date(Date.now() + DAYS * 86400_000).toUTCString();
    // Lax rather than None: this is first-party attribution, and the round trip
    // to the broker and back is a top-level navigation, which Lax allows.
    document.cookie = `${COOKIE}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
  } catch {
    /* cookies blocked — localStorage still carries it for this browser */
  }
}

export function saveIBClick(broker: Broker, code: string): void {
  const info: IBInfo = { broker, code, clickTime: Date.now() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(info));
  } catch {
    /* private mode */
  }
  writeCookie(`${broker}_${code}`);
}

export function getIBInfo(): IBInfo | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as IBInfo;
      if (isBroker(parsed?.broker) && parsed.code) return parsed;
    }
  } catch {
    /* fall through to the cookie */
  }
  try {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`));
    if (!hit) return null;
    const [broker, ...rest] = decodeURIComponent(hit.slice(COOKIE.length + 1)).split("_");
    if (!isBroker(broker) || !rest.length) return null;
    return { broker, code: rest.join("_"), clickTime: 0 };
  } catch {
    return null;
  }
}

/**
 * Reads attribution off the current URL.
 *
 * Accepts `?ib=VTMarkets_CODE`, `?broker=VTMarkets&ib=CODE` and a bare `?ref=CODE`
 * (which needs `?broker=` to say which broker it belongs to — a code with no
 * broker cannot be attributed, so it is ignored rather than guessed at).
 */
export function captureFromUrl(search: string): IBInfo | null {
  const params = new URLSearchParams(search);
  const rawBroker = params.get("broker");
  const ib = params.get("ib");
  const ref = params.get("ref");

  let broker: string | null = rawBroker;
  let code: string | null = ref;

  if (ib) {
    const under = ib.indexOf("_");
    if (under > 0 && isBroker(ib.slice(0, under))) {
      broker = ib.slice(0, under);
      code = ib.slice(under + 1);
    } else {
      code = ib;
    }
  }

  if (!isBroker(broker) || !code) return null;
  saveIBClick(broker, code);
  return { broker, code, clickTime: Date.now() };
}
