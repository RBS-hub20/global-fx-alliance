import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Calls into the execution VPS.
 *
 * The VPS itself is not in this repo and is not built here — it is the Python
 * MT5 bridge. This module is only the signed HTTP client for it.
 *
 * Every request is HMAC-SHA256 signed over the exact body bytes with VPS_SECRET,
 * so the bridge can reject anything that did not come from this deployment. The
 * timestamp is inside the signed body rather than beside it, which is what stops
 * a captured request being replayed an hour later.
 */

const TIMEOUT_MS = 10_000;

export interface VpsResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

function config(): { base: string; secret: string } | null {
  const base = process.env.VPS_IP;
  const secret = process.env.VPS_SECRET;
  if (!base || !secret) return null;
  return { base: base.replace(/\/+$/, ""), secret };
}

export function vpsReady(): boolean {
  return config() !== null;
}

export function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** For the bridge's callbacks into us, when that route is written. */
export function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(sign(body, secret), "utf8");
  const got = Buffer.from(signature, "utf8");
  return expected.length === got.length && timingSafeEqual(expected, got);
}

async function call<T>(path: string, payload: unknown, retries: number): Promise<VpsResult<T>> {
  const cfg = config();
  if (!cfg) return { ok: false, status: 503, data: null, error: "VPS bridge is not configured." };

  // Signed over the serialised string, and that same string is sent — signing a
  // re-serialisation would let key order drift and break verification.
  const body = JSON.stringify({ ...(payload as object), ts: Date.now() });
  const signature = sign(body, cfg.secret);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${cfg.base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Signature": signature },
        body,
        signal: ctrl.signal,
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as T | null;
      if (!res.ok) {
        // 4xx is the bridge saying no; retrying will get the same no.
        if (res.status < 500 || attempt === retries) {
          return { ok: false, status: res.status, data, error: `Bridge refused (${res.status}).` };
        }
        continue;
      }
      return { ok: true, status: res.status, data, error: null };
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      if (attempt === retries) {
        return { ok: false, status: 504, data: null, error: aborted ? "Bridge timed out." : "Bridge unreachable." };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: 504, data: null, error: "Bridge unreachable." };
}

export interface TestConnectResult { connected: boolean; balance?: number; currency?: string; message?: string }
export interface ExecuteResult { ticket?: number; filledPrice?: number; message?: string }

/** Verifies the credentials against MT5 and reads the balance back. */
export function testConnect(input: {
  accountNumber: string; password: string; server: string; passwordType: "investor" | "master";
}): Promise<VpsResult<TestConnectResult>> {
  return call<TestConnectResult>("/test-connect", input, 1);
}

/**
 * Places the trade. Not retried: a timeout is not proof the order did not fill,
 * and a second attempt on an order that did fill opens a second position. The
 * caller records FAILED and a human reconciles.
 */
export function executeTrade(input: {
  accountNumber: string; password: string; server: string;
  symbol: string; action: "BUY" | "SELL" | "CLOSE";
  lot: number; sl: number | null; tp: number | null; logId: string;
}): Promise<VpsResult<ExecuteResult>> {
  return call<ExecuteResult>("/execute", input, 0);
}
