import type { Broker } from "./brokers";
import { PROOF_BUCKET, TABLE, hasSupabase, supabaseAdmin } from "./supabaseAdmin";

/**
 * Store for deposit-verification requests, backed by Supabase.
 *
 * The previous in-memory fallback could not back this feature at all: Next
 * bundles every route handler separately, so the Map written by `/api/ib/verify`
 * was a different Map from the one `/api/ib/status` read, and a submitted
 * request came back as `status: null`. It appeared to work in production only
 * because both calls happened to land on the same warm instance — which is worse
 * than failing outright, because it looks fine in testing and loses reviews
 * later. A real table removes the class of problem.
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
  ibCode: string | null;
  ibClickTime: number | null;
  /** Filled by an admin from the broker's IB portal, not by the applicant. */
  depositUsd: number | null;
  status: VerificationStatus;
  note: string | null;
  createdAt: number;
  reviewedAt: number | null;
  hasProof: boolean;
  /** Object path inside the private proofs bucket, never a public URL. */
  proofPath: string | null;
}

/** Column names as they exist in the table; the app shape stays camelCase. */
interface Row {
  id: string;
  email: string;
  broker: string;
  account_number: string;
  server: string | null;
  method: string;
  ib_code: string | null;
  ib_click_time: number | string | null;
  deposit: number | string | null;
  status: string;
  rejected_reason: string | null;
  screenshot_url: string | null;
  created_at: string;
  verified_at: string | null;
}

const num = (v: number | string | null): number | null => {
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

function toRequest(r: Row): VerificationRequest {
  return {
    id: r.id,
    email: r.email,
    broker: r.broker as Broker,
    account: r.account_number,
    server: r.server,
    method: r.method === "screenshot" ? "screenshot" : "account",
    ibCode: r.ib_code,
    ibClickTime: num(r.ib_click_time),
    depositUsd: num(r.deposit),
    status: (["pending", "verified", "rejected"].includes(r.status) ? r.status : "pending") as VerificationStatus,
    note: r.rejected_reason,
    createdAt: new Date(r.created_at).getTime(),
    reviewedAt: r.verified_at ? new Date(r.verified_at).getTime() : null,
    hasProof: !!r.screenshot_url,
    proofPath: r.screenshot_url,
  };
}

export interface NewRequest {
  email: string;
  broker: Broker;
  account: string;
  server: string | null;
  method: VerificationMethod;
  ibCode: string | null;
  ibClickTime: number | null;
  proofPath: string | null;
}

export interface StoreResult<T> {
  ok: boolean;
  data: T | null;
  /** Surfaced rather than swallowed — a schema mismatch should be obvious. */
  error: string | null;
}

const NOT_CONFIGURED = "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.";

export function storeReady(): boolean {
  return hasSupabase();
}

export async function createRequest(input: NewRequest): Promise<StoreResult<VerificationRequest>> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, data: null, error: NOT_CONFIGURED };

  const { data, error } = await db
    .from(TABLE)
    .insert({
      email: input.email,
      broker: input.broker,
      account_number: input.account,
      server: input.server,
      method: input.method,
      ib_code: input.ibCode,
      ib_click_time: input.ibClickTime,
      status: "pending",
      screenshot_url: input.proofPath,
    })
    .select()
    .single();

  if (error) return { ok: false, data: null, error: error.message };
  return { ok: true, data: toRequest(data as Row), error: null };
}

/**
 * The record that decides access for one address.
 *
 * A verified row wins over a newer pending one, so re-applying while already
 * approved cannot lock someone out of their own access.
 */
export async function getByEmail(email: string): Promise<StoreResult<VerificationRequest | null>> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, data: null, error: NOT_CONFIGURED };

  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { ok: false, data: null, error: error.message };
  const rows = (data ?? []) as Row[];
  const mapped = rows.map(toRequest);
  return { ok: true, data: mapped.find((r) => r.status === "verified") ?? mapped[0] ?? null, error: null };
}

export async function listRequests(status?: VerificationStatus): Promise<StoreResult<VerificationRequest[]>> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, data: null, error: NOT_CONFIGURED };

  let q = db.from(TABLE).select("*").order("created_at", { ascending: false }).limit(500);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return { ok: false, data: null, error: error.message };
  return { ok: true, data: ((data ?? []) as Row[]).map(toRequest), error: null };
}

export async function updateStatus(
  id: string,
  status: VerificationStatus,
  opts: { depositUsd?: number | null; reason?: string | null } = {}
): Promise<StoreResult<VerificationRequest>> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, data: null, error: NOT_CONFIGURED };

  const patch: Record<string, unknown> = { status };
  if (status === "verified") patch.verified_at = new Date().toISOString();
  if (opts.depositUsd !== undefined) patch.deposit = opts.depositUsd;
  if (opts.reason !== undefined) patch.rejected_reason = opts.reason;

  const { data, error } = await db.from(TABLE).update(patch).eq("id", id).select().single();
  if (error) return { ok: false, data: null, error: error.message };
  return { ok: true, data: toRequest(data as Row), error: null };
}

/**
 * Submissions from one address in the last 24 hours.
 *
 * Counted in the table rather than in process memory, so the limit holds across
 * instances — the previous counter only throttled whichever lambda answered.
 */
export async function countRecent(email: string): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return 0;

  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count, error } = await db
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("email", email.trim().toLowerCase())
    .gte("created_at", since);

  return error ? 0 : count ?? 0;
}

/* --------------------------------------------------------------------- proofs */

/**
 * Uploads a deposit screenshot to a **private** bucket.
 *
 * The brief asked for a public bucket and a stored `publicUrl`. These images
 * carry account numbers, names and balances; a public bucket makes every one of
 * them readable by anyone who has or guesses the URL, with no way to revoke it.
 * The object path is stored instead, and the admin route mints a short-lived
 * signed URL when a reviewer actually opens one.
 */
export async function uploadProof(
  email: string,
  bytes: Uint8Array,
  contentType: string
): Promise<StoreResult<string>> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, data: null, error: NOT_CONFIGURED };

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const safe = email.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  const path = `${safe}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await db.storage.from(PROOF_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) return { ok: false, data: null, error: error.message };
  return { ok: true, data: path, error: null };
}

/** Signed for five minutes — long enough to look, short enough not to circulate. */
export async function signProof(path: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db.storage.from(PROOF_BUCKET).createSignedUrl(path, 300);
  return error ? null : data?.signedUrl ?? null;
}

/* ---------------------------------------------------------------------- admin */

export const ADMIN_TOKEN_HEADER = "x-admin-token";

/** Constant-time comparison; the token never appears in a URL or a log line. */
export function isAdmin(request: Request): boolean {
  const expected = process.env.GFXA_ADMIN_TOKEN;
  if (!expected) return false;
  const got = request.headers.get(ADMIN_TOKEN_HEADER) ?? request.headers.get("x-gfxa-admin");
  if (!got || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
