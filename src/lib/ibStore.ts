import type { Broker } from "./brokers";

/**
 * Store for deposit-verification requests.
 *
 * **This default is not durable.** There is no database wired to this project,
 * and a Vercel function's memory does not survive a redeploy or span instances,
 * so pending requests written here can disappear. It is enough to exercise the
 * flow end to end and it keeps the shape a real store has to implement, but the
 * feature is not production-ready until `IBStore` is backed by something that
 * persists — Vercel KV, Postgres, Supabase. The admin panel says so out loud
 * rather than letting anyone assume the queue is safe.
 */

export type VerificationStatus = "pending" | "verified" | "rejected";
export type VerificationMethod = "account" | "screenshot";

export interface VerificationRequest {
  id: string;
  email: string;
  broker: Broker;
  /** Trading account number. Never a password — see the verify route. */
  account: string;
  server: string | null;
  method: VerificationMethod;
  /** Attribution captured when they clicked through, if any. */
  ibCode: string | null;
  ibClickTime: number | null;
  /** Filled by an admin from the broker's IB portal, not by the applicant. */
  depositUsd: number | null;
  status: VerificationStatus;
  note: string | null;
  createdAt: number;
  reviewedAt: number | null;
  /** Set when the applicant attached a screenshot; the image itself is not kept. */
  hasProof: boolean;
}

export interface IBStore {
  put(r: VerificationRequest): Promise<void>;
  byEmail(email: string): Promise<VerificationRequest | null>;
  list(): Promise<VerificationRequest[]>;
  update(id: string, patch: Partial<VerificationRequest>): Promise<VerificationRequest | null>;
  /** False when the backing store cannot survive a redeploy. */
  durable: boolean;
}

const mem = new Map<string, VerificationRequest>();

/**
 * In-process fallback.
 *
 * Next bundles every route handler separately, so this Map is a *different* Map
 * in each route — a request written by /verify is invisible to /status. It is
 * kept only so the code paths run in development; it cannot back the feature.
 * `durable: false` is what the UI keys off to say so.
 */
export const memoryStore: IBStore = {
  durable: false,
  async put(r) {
    mem.set(r.id, r);
  },
  async byEmail(email) {
    const key = email.trim().toLowerCase();
    const all = Array.from(mem.values())
      .filter((r) => r.email === key)
      .sort((a, b) => b.createdAt - a.createdAt);
    return all.find((r) => r.status === "verified") ?? all[0] ?? null;
  },
  async list() {
    return Array.from(mem.values()).sort((a, b) => b.createdAt - a.createdAt);
  },
  async update(id, patch) {
    const cur = mem.get(id);
    if (!cur) return null;
    const next = { ...cur, ...patch };
    mem.set(id, next);
    return next;
  },
};

/* ------------------------------------------------------------------ KV store */

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

/**
 * Vercel KV / Upstash over their REST API — plain fetch, no client library.
 *
 * Provisioning Vercel KV on the project sets both variables automatically, and
 * this takes over the moment they exist.
 */
async function kv<T = unknown>(command: unknown[]): Promise<T | null> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(KV_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return (json?.result ?? null) as T | null;
  } catch {
    return null;
  }
}

const REQ = (id: string) => `ib:req:${id}`;
const INDEX = "ib:index";

const parse = (raw: unknown): VerificationRequest | null => {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as VerificationRequest;
  } catch {
    return null;
  }
};

export const kvStore: IBStore = {
  durable: true,
  async put(r) {
    await kv(["SET", REQ(r.id), JSON.stringify(r)]);
    await kv(["SADD", INDEX, r.id]);
  },
  async list() {
    const ids = (await kv<string[]>(["SMEMBERS", INDEX])) ?? [];
    if (!ids.length) return [];
    const raw = (await kv<unknown[]>(["MGET", ...ids.map(REQ)])) ?? [];
    return raw
      .map(parse)
      .filter((r): r is VerificationRequest => r !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  async byEmail(email) {
    const key = email.trim().toLowerCase();
    const all = (await this.list()).filter((r) => r.email === key);
    // A verified record wins over a newer pending one, so re-applying while
    // already approved cannot lock someone out of their own access.
    return all.find((r) => r.status === "verified") ?? all[0] ?? null;
  },
  async update(id, patch) {
    const cur = parse(await kv(["GET", REQ(id)]));
    if (!cur) return null;
    const next = { ...cur, ...patch };
    await kv(["SET", REQ(id), JSON.stringify(next)]);
    return next;
  },
};

export function getStore(): IBStore {
  return KV_URL && KV_TOKEN ? kvStore : memoryStore;
}

/* ------------------------------------------------------------- rate limiting */

const attempts = new Map<string, number[]>();
const DAY = 86400_000;

/**
 * Five submissions per email per day. Best-effort: this counter lives in the
 * verify route's own module memory, so it throttles per instance rather than
 * globally. It raises the cost of flooding the queue; it is not a hard cap.
 */
export function tooManyAttempts(email: string, limit = 5): boolean {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < DAY);
  if (recent.length >= limit) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  return false;
}

export const ADMIN_TOKEN_HEADER = "x-gfxa-admin";

/** Constant-ish comparison; the token never appears in a URL or a log line. */
export function isAdmin(request: Request): boolean {
  const expected = process.env.GFXA_ADMIN_TOKEN;
  if (!expected) return false;
  const got = request.headers.get(ADMIN_TOKEN_HEADER);
  if (!got || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
